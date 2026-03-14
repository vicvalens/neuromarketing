#!/usr/bin/env python3
# EEG_Simulator.py
# Simulador de EEG (8 canales) por LSL con modo CLI o mini-GUI.
# Publica un stream LSL tipo "EEG" para ser consumido por tu GUI de engagement.

import argparse
import time
import threading
from dataclasses import dataclass
import numpy as np
import sys

# ---------------- LSL (compatibilidad cf_float32 / CF_FLOAT32) ----------------
try:
    from pylsl import StreamInfo, StreamOutlet
    try:
        from pylsl import cf_float32 as LSL_FLOAT32  # pylsl moderno
    except ImportError:
        from pylsl import CF_FLOAT32 as LSL_FLOAT32  # pylsl legacy
except Exception:
    print("ERROR: pylsl no está instalado. Instala con: pip install pylsl")
    raise

# ---------------- (Opcional) mini-GUI sin diálogos ----------------
try:
    import tkinter as tk
    from tkinter import ttk
    HAS_TK = True
except Exception:
    HAS_TK = False

# ---------------- Config por defecto ----------------
DEFAULT_NAME = "AURA"       # Usa este nombre en tu GUI de engagement (LSL_STREAM_NAME="AURA")
DEFAULT_FS   = 250
DEFAULT_SEED = 123
CH_LABELS = ["Fp1","Fp2","F3","F4","C3","C4","Pz","Oz"]
N_CH = len(CH_LABELS)

# ---------------- Modelo de señal ----------------
@dataclass
class EEGParams:
    fs: int = DEFAULT_FS
    theta_hz: float = 6.0
    alpha_hz: float = 10.0
    beta_hz: float  = 20.0
    theta_amp: float = 8e-6
    alpha_amp: float = 10e-6
    beta_amp:  float = 3e-6
    noise_sd:  float = 2e-6
    beta_gain_A: float = 1.0
    beta_gain_B: float = 1.8
    beta_gain_C: float = 1.2
    blink_prob: float = 0.015   # prob./s de iniciar blink
    blink_amp:  float = 60e-6   # amplitud blink (Fp1/Fp2)
    blink_dur_s: float = 0.12   # duración del blink

class EEGSimulator:
    def __init__(self, params: EEGParams, seed=DEFAULT_SEED):
        self.p = params
        self.rng = np.random.default_rng(seed)
        self.t = 0.0
        self.dt = 1.0 / self.p.fs
        self.segment = "A"   # A/B/C (controla ganancia beta)
        self._blink_remaining = 0  # samples restantes de blink
        self._blink_len = max(1, int(self.p.blink_dur_s * self.p.fs))

    def set_segment(self, seg: str):
        self.segment = seg

    def _current_beta_gain(self):
        return {"A": self.p.beta_gain_A, "B": self.p.beta_gain_B, "C": self.p.beta_gain_C}.get(self.segment, 1.0)

    def _maybe_start_blink(self):
        if self._blink_remaining == 0:
            # probabilidad por muestra equivalente a prob/s
            if self.rng.uniform() < self.p.blink_prob * self.dt:
                self._blink_remaining = self._blink_len

    def next_sample(self):
        """Genera una muestra (lista) de 8 canales EEG crudos."""
        self._maybe_start_blink()
        gain_beta = self._current_beta_gain()
        sample = []

        for ch_idx in range(N_CH):
            phase = 0.05 * ch_idx
            s = (
                self.p.theta_amp * np.sin(2*np.pi*self.p.theta_hz*self.t + phase)
                + self.p.alpha_amp * np.sin(2*np.pi*self.p.alpha_hz*self.t + 0.3 + phase)
                + self.p.beta_amp  * gain_beta * np.sin(2*np.pi*self.p.beta_hz *self.t + 0.7 + phase)
            )
            s += self.rng.normal(0.0, self.p.noise_sd)

            # Blink en Fp1/Fp2 (canales 0 y 1) como pulso triangular
            if self._blink_remaining > 0 and ch_idx in (0,1):
                k = self._blink_remaining / self._blink_len  # 1..0
                tri = 1.0 - abs(1.0 - 2.0*k)                 # 0..1..0
                s += self.p.blink_amp * tri

            sample.append(float(s))

        if self._blink_remaining > 0:
            self._blink_remaining -= 1

        self.t += self.dt
        return sample

# ---------------- Publicador LSL ----------------
class LSLStreamer:
    def __init__(self, name=DEFAULT_NAME, fs=DEFAULT_FS, channel_labels=CH_LABELS):
        self.name = name
        self.fs = fs
        self.channel_labels = channel_labels

        self.info = StreamInfo(
            name=self.name,
            type="EEG",
            channel_count=len(channel_labels),
            nominal_srate=self.fs,
            channel_format=LSL_FLOAT32,  # compatible con cf_float32/CF_FLOAT32
            source_id=f"sim_{self.name}_{self.fs}_{len(channel_labels)}"
        )
        chns = self.info.desc().append_child("channels")
        for lab in self.channel_labels:
            ch = chns.append_child("channel")
            ch.append_child_value("label", lab)
            ch.append_child_value("unit", "V")
            ch.append_child_value("type", "EEG")
        self.info.desc().append_child_value("manufacturer", "SimEEG")

        self.outlet = StreamOutlet(self.info, chunk_size=0, max_buffered=360)

    def push_sample(self, sample):
        self.outlet.push_sample(sample)

# ---------------- Runner headless (CLI) ----------------
def run_headless(name, fs, seed, segment, betaA, betaB, betaC, noise_sd, blink_prob):
    params = EEGParams(
        fs=fs, beta_gain_A=betaA, beta_gain_B=betaB, beta_gain_C=betaC,
        noise_sd=noise_sd, blink_prob=blink_prob
    )
    sim = EEGSimulator(params, seed=seed)
    sim.set_segment(segment)
    lsl = LSLStreamer(name=name, fs=fs)

    print(f"[SIM] Streaming LSL name={name} fs={fs} ch={N_CH} segment={segment}")
    print("      Ctrl+C para detener.")
    period = 1.0 / fs
    next_ts = time.perf_counter()
    try:
        while True:
            s = sim.next_sample()
            lsl.push_sample(s)
            next_ts += period
            delay = next_ts - time.perf_counter()
            if delay > 0:
                time.sleep(delay)
    except KeyboardInterrupt:
        print("\n[SIM] detenido.")

# ---------------- Mini-GUI ----------------
class SimGUI:
    def __init__(self, args):
        self.args = args
        self.root = tk.Tk()
        self.root.title("EEG LSL Simulator (8ch)")

        self.running = False
        self.segment = tk.StringVar(value=args.segment)
        self.betaA = tk.DoubleVar(value=args.betaA)
        self.betaB = tk.DoubleVar(value=args.betaB)
        self.betaC = tk.DoubleVar(value=args.betaC)
        self.noise = tk.DoubleVar(value=args.noise)
        self.blinkp = tk.DoubleVar(value=args.blinkp)

        frm = ttk.Frame(self.root, padding=8); frm.pack(fill="both", expand=True)
        ttk.Label(frm, text=f"LSL name: {args.name}   fs: {args.fs} Hz   channels: {N_CH}").pack(anchor="w")

        row1 = ttk.Frame(frm); row1.pack(fill="x", pady=4)
        ttk.Label(row1, text="Segment:").pack(side="left")
        for lab in ("A","B","C"):
            ttk.Radiobutton(row1, text=lab, variable=self.segment, value=lab).pack(side="left", padx=4)

        row2 = ttk.Frame(frm); row2.pack(fill="x", pady=4)
        ttk.Label(row2, text="β gain A").pack(side="left")
        ttk.Scale(row2, from_=0.2, to=2.5, variable=self.betaA, orient="horizontal", length=220).pack(side="left", padx=6)
        ttk.Label(row2, text="β gain B").pack(side="left")
        ttk.Scale(row2, from_=0.2, to=3.0, variable=self.betaB, orient="horizontal", length=220).pack(side="left", padx=6)
        ttk.Label(row2, text="β gain C").pack(side="left")
        ttk.Scale(row2, from_=0.2, to=2.5, variable=self.betaC, orient="horizontal", length=220).pack(side="left", padx=6)

        row3 = ttk.Frame(frm); row3.pack(fill="x", pady=6)
        ttk.Label(row3, text="Noise SD (V)").pack(side="left")
        ttk.Scale(row3, from_=0.0, to=8e-6, variable=self.noise, orient="horizontal", length=260).pack(side="left", padx=6)
        ttk.Label(row3, text="Blink prob/s").pack(side="left")
        ttk.Scale(row3, from_=0.0, to=0.08, variable=self.blinkp, orient="horizontal", length=180).pack(side="left", padx=6)

        row4 = ttk.Frame(frm); row4.pack(fill="x", pady=10)
        self.btn = ttk.Button(row4, text="Start", command=self.toggle)
        self.btn.pack(side="left")
        ttk.Button(row4, text="Quit", command=self.quit).pack(side="left", padx=6)

        self.status = ttk.Label(frm, text="Stopped")
        self.status.pack(anchor="w", pady=(8,0))

        # Instancias simulador/outlet
        self.params = EEGParams(fs=args.fs, beta_gain_A=self.betaA.get(),
                                beta_gain_B=self.betaB.get(), beta_gain_C=self.betaC.get(),
                                noise_sd=self.noise.get(), blink_prob=self.blinkp.get())
        self.sim = EEGSimulator(self.params, seed=args.seed)
        self.lsl = LSLStreamer(name=args.name, fs=args.fs)

        # loop de refresco de parámetros
        self.root.after(200, self._refresh_params)

    def _refresh_params(self):
        self.sim.set_segment(self.segment.get())
        self.sim.p.beta_gain_A = self.betaA.get()
        self.sim.p.beta_gain_B = self.betaB.get()
        self.sim.p.beta_gain_C = self.betaC.get()
        self.sim.p.noise_sd    = self.noise.get()
        self.sim.p.blink_prob  = self.blinkp.get()
        self.root.after(200, self._refresh_params)

    def toggle(self):
        if not self.running:
            self.running = True
            self.btn.config(text="Stop")
            self.status.config(text=f"Streaming LSL: {self.args.name} @ {self.args.fs} Hz")
            th = threading.Thread(target=self._loop, daemon=True)
            th.start()
        else:
            self.running = False
            self.btn.config(text="Start")
            self.status.config(text="Stopped")

    def _loop(self):
        period = 1.0 / self.args.fs
        next_ts = time.perf_counter()
        while self.running:
            s = self.sim.next_sample()
            self.lsl.push_sample(s)
            next_ts += period
            delay = next_ts - time.perf_counter()
            if delay > 0:
                time.sleep(delay)

    def quit(self):
        self.running = False
        self.root.destroy()

    def run(self):
        self.root.mainloop()

# ---------------- CLI ----------------
def parse_args():
    ap = argparse.ArgumentParser(description="Simulador EEG 8ch por LSL")
    ap.add_argument("--name", default=DEFAULT_NAME, help="Nombre del stream LSL (e.g., AURA)")
    ap.add_argument("--fs", type=int, default=DEFAULT_FS, help="Frecuencia de muestreo (Hz)")
    ap.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Semilla RNG")

    ap.add_argument("--segment", choices=["A","B","C"], default="A", help="Segmento inicial")
    ap.add_argument("--betaA", type=float, default=1.0, help="Ganancia beta A")
    ap.add_argument("--betaB", type=float, default=1.8, help="Ganancia beta B")
    ap.add_argument("--betaC", type=float, default=1.2, help="Ganancia beta C")
    ap.add_argument("--noise", type=float, default=2e-6, help="Desv. estándar del ruido (V)")
    ap.add_argument("--blinkp", type=float, default=0.015, help="Probabilidad de blink por segundo")

    ap.add_argument("--gui", action="store_true", help="Lanza mini-GUI (si Tk está disponible)")
    return ap.parse_args()

if __name__ == "__main__":
    args = parse_args()
    # Fuerza GUI por defecto si Tk está disponible
    if HAS_TK:
        # Si quieres respetar --gui/--no-gui, comenta estas 2 líneas
        args.gui = True

    if args.gui:
        if not HAS_TK:
            print("Tk no disponible. Ejecuta sin GUI o instala Tk.")
            sys.exit(1)
        SimGUI(args).run()
    else:
        run_headless(
            name=args.name, fs=args.fs, seed=args.seed,
            segment=args.segment, betaA=args.betaA, betaB=args.betaB, betaC=args.betaC,
            noise_sd=args.noise, blink_prob=args.blinkp
        )

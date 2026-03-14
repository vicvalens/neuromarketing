import customtkinter as ctk
import serial
import serial.tools.list_ports as list_ports
import threading
import numpy as np
from collections import deque
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import time

class BCIProController(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("NEUROVISOR BCI - Machine Learning Edition")
        self.geometry("1400x900")
        
        # Datos y ML
        self.maxlen = 400
        self.buf1 = deque([0.0] * self.maxlen, maxlen=self.maxlen)
        self.training_data = {"ABRIR": [], "CERRAR": []}
        self.is_recording = None
        self.model_trained = False
        
        # Estado
        self.ser = None
        self.connected = False
        self.threshold = ctk.DoubleVar(value=150.0)
        self.ai_confidence = ctk.DoubleVar(value=0.0)

        self._build_ui()
        self.after(100, self._update_loop)

    def _build_ui(self):
        self.grid_columnconfigure(1, weight=1)
        
        # --- Sidebar Izquierda: Controles ML ---
        self.sidebar = ctk.CTkFrame(self, width=320, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        ctk.CTkLabel(self.sidebar, text="BCI ENGINE v2.0", font=("Arial", 24, "bold"), text_color="#22d3ee").pack(pady=20)
        
        # Conexión
        self.port_var = ctk.StringVar()
        ports = [p.device for p in list_ports.comports() if "Bluetooth" not in p.device]
        self.port_menu = ctk.CTkOptionMenu(self.sidebar, variable=self.port_var, values=ports if ports else ["No Ports"])
        self.port_menu.pack(pady=10, padx=20)
        
        self.btn_conn = ctk.CTkButton(self.sidebar, text="CONECTAR SISTEMA", command=self.toggle_connection, fg_color="#1e293b", border_width=2)
        self.btn_conn.pack(pady=10, padx=20)

        ctk.CTkLabel(self.sidebar, text="--- CALIBRACIÓN IA ---", font=("Arial", 12, "bold")).pack(pady=(20, 5))
        
        # Botones de Entrenamiento
        self.btn_rec_open = ctk.CTkButton(self.sidebar, text="GRAVAR PATRÓN: ABRIR", fg_color="#0891b2", command=lambda: self._start_recording("ABRIR"))
        self.btn_rec_open.pack(pady=5, padx=20)
        
        self.btn_rec_close = ctk.CTkButton(self.sidebar, text="GRAVAR PATRÓN: CERRAR", fg_color="#7e22ce", command=lambda: self._start_recording("CERRAR"))
        self.btn_rec_close.pack(pady=5, padx=20)
        
        self.btn_train = ctk.CTkButton(self.sidebar, text="ENTRENAR MODELO ML", fg_color="#f59e0b", text_color="black", command=self._train_model)
        self.btn_train.pack(pady=20, padx=20)

        # Indicadores de IA
        ctk.CTkLabel(self.sidebar, text="Confianza de Predicción:").pack()
        self.conf_bar = ctk.CTkProgressBar(self.sidebar, variable=self.ai_confidence)
        self.conf_bar.pack(pady=10, padx=20)

        self.status_label = ctk.CTkLabel(self.sidebar, text="SISTEMA LISTO", font=("Arial", 20, "bold"), fg_color="#334155", corner_radius=8, height=60)
        self.status_label.pack(pady=20, padx=20, fill="x")

        # --- Área Principal: Gráficas ---
        self.main_frame = ctk.CTkFrame(self, fg_color="#020617")
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        
        self.fig = Figure(figsize=(10, 8), facecolor='#020617')
        self.ax = self.fig.add_subplot(111)
        self.ax.set_facecolor('#020617')
        self.line1, = self.ax.plot([], [], color='#22d3ee', lw=2, label="Señal Prefrontal")
        self.ax.set_ylim(0, 600)
        self.ax.grid(True, alpha=0.1)
        
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.main_frame)
        self.canvas.get_tk_widget().pack(fill="both", expand=True, padx=20, pady=20)

    # --- Lógica de Machine Learning ---
    def _start_recording(self, label):
        self.status_label.configure(text=f"GRABANDO {label}...", fg_color="#b91c1c")
        self.is_recording = label
        # Grabamos por 3 segundos
        self.after(3000, self._stop_recording)

    def _stop_recording(self):
        self.is_recording = None
        self.status_label.configure(text="DATOS GUARDADOS", fg_color="#15803d")
        self.after(2000, lambda: self.status_label.configure(text="SISTEMA LISTO", fg_color="#334155"))

    def _extract_features(self, data_window):
        """Extrae características matemáticas de la señal"""
        return [np.mean(data_window), np.std(data_window), np.max(data_window)]

    def _train_model(self):
        if len(self.training_data["ABRIR"]) > 0 and len(self.training_data["CERRAR"]) > 0:
            self.model_trained = True
            self.status_label.configure(text="IA ENTRENADA", fg_color="#1d4ed8")
        else:
            self.status_label.configure(text="FALTAN DATOS", fg_color="orange")

    def toggle_connection(self):
        if not self.connected:
            threading.Thread(target=self._async_connect, daemon=True).start()
        else:
            self.disconnect()

    def _async_connect(self):
        try:
            self.ser = serial.Serial(self.port_var.get(), 115200, timeout=0.1)
            time.sleep(1.2)
            self.connected = True
            threading.Thread(target=self._reader_thread, daemon=True).start()
        except: pass

    def disconnect(self):
        self.connected = False
        if self.ser: self.ser.close()

    def _reader_thread(self):
        while self.connected:
            if self.ser.in_waiting:
                line = self.ser.readline().decode(errors='ignore').strip()
                if line.startswith("DATA,"):
                    parts = line.split(",")
                    val = abs(float(parts[1]) - 512)
                    self.buf1.append(val)
                    
                    if self.is_recording:
                        self.training_data[self.is_recording].append(val)

    def _update_loop(self):
        if self.connected:
            data = list(self.buf1)
            self.line1.set_data(np.arange(len(data)), data)
            self.ax.set_xlim(0, len(data))
            
            # Si el modelo está entrenado, predecimos en tiempo real
            if self.model_trained:
                current_features = self._extract_features(data[-20:])
                # Lógica simplificada de clasificación (ML de base)
                mean_open = np.mean(self.training_data["ABRIR"])
                mean_close = np.mean(self.training_data["CERRAR"])
                
                # Decisión basada en la distancia al promedio entrenado
                dist_open = abs(np.mean(data[-20:]) - mean_open)
                dist_close = abs(np.mean(data[-20:]) - mean_close)
                
                if dist_open < dist_close:
                    self.status_label.configure(text="PREDICCIÓN: ABRIR", fg_color="#0891b2")
                    self.ai_confidence.set(0.8) # Ejemplo de confianza
                    self.ser.write(b"SERVO,180\n")
                else:
                    self.status_label.configure(text="PREDICCIÓN: CERRAR", fg_color="#7e22ce")
                    self.ai_confidence.set(0.9)
                    self.ser.write(b"SERVO,0\n")

            self.canvas.draw_idle()
        self.after(50, self._update_loop)

if __name__ == "__main__":
    app = BCIProController()
    app.mainloop()
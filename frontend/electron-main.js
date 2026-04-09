import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

let mainWindow;

// 1. CONFIGURA TU CARPETA AQUÍ
const CARPETA_ESCANER = 'D:\\Escaneos'; 
// 2. LA URL DE TU BACKEND LOCAL
const API_URL = 'http://localhost:8000/api/scan-document?save_to_queue=true';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Hostly - Gestión de Albergues",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('http://localhost:8080'); // Tu puerto de Vite

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  iniciarVigilanteEscaner();
}

function iniciarVigilanteEscaner() {
  if (!fs.existsSync(CARPETA_ESCANER)) {
    fs.mkdirSync(CARPETA_ESCANER, { recursive: true });
  }

  console.log(`👀 Vigilando la carpeta del escáner en: ${CARPETA_ESCANER}`);

  // NUEVO: Usamos un Map para guardar un temporizador distinto por CADA archivo
  const timers = new Map();

  fs.watch(CARPETA_ESCANER, (evento, nombreArchivo) => {
    if (nombreArchivo) {
      const rutaCompleta = path.join(CARPETA_ESCANER, nombreArchivo);
      
      // Si el archivo no existe (ej. se acaba de borrar), lo ignoramos
      if (!fs.existsSync(rutaCompleta)) return;

      // Si este archivo en concreto ya tenía un temporizador, lo reiniciamos
      if (timers.has(rutaCompleta)) {
        clearTimeout(timers.get(rutaCompleta));
      }

      // Creamos un temporizador EXCLUSIVO para este archivo
      const nuevoTemporizador = setTimeout(async () => {
        // Una vez que arranca, lo borramos de la lista de temporizadores
        timers.delete(rutaCompleta); 

        console.log(`\n🚨 DNI Detectado: ${nombreArchivo}. Enviando a IA...`);
        
        try {
          // 1. Leer el archivo
          const fileBuffer = fs.readFileSync(rutaCompleta);
          
          // 2. Empaquetarlo
          const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
          const formData = new FormData();
          formData.append('file', blob, nombreArchivo);

          // 3. Enviarlo al backend
          const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
          });

          const data = await response.json();
          
          if (data.status === "success") {
            console.log("✅ IA completada! Huésped:", data.data.guestName, data.data.surname);
            
            // 4. Borramos la foto (verificando que sigue ahí por si acaso)
            if (fs.existsSync(rutaCompleta)) {
                fs.unlinkSync(rutaCompleta);
                console.log(`🗑️ Archivo ${nombreArchivo} eliminado de la carpeta.`);
            }
          } else {
            console.error(`❌ Error de la IA procesando ${nombreArchivo}:`, data.error);
          }

        } catch (error) {
          console.error(`❌ Error enviando ${nombreArchivo} al backend:`, error.message);
        }
        
      }, 1000); // He subido el tiempo a 1 segundo para darle margen a Windows si copias muchos de golpe

      // Guardamos el temporizador en el diccionario asociado a este archivo
      timers.set(rutaCompleta, nuevoTemporizador);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
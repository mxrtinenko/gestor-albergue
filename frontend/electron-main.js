import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// NUEVO: Necesario para que funcione __dirname al usar "type": "module" en package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// 1. CARPETA POR DEFECTO MÁS SEGURA (Documentos del usuario)
let CARPETA_ESCANER = path.join(app.getPath('documents'), 'Escaneos_Hostly'); 

// 2. ¡LA URL DE RAILWAY! (Actualizada para el escáner)
const API_URL = 'https://gestor-albergue-production.up.railway.app/api/scan-document?save_to_queue=true';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Hostly - Gestión de Albergues",
    icon: path.join(__dirname, app.isPackaged ? 'dist/icon.ico' : 'public/icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 3. LA MAGIA PARA EL .EXE (CRÍTICO)
  if (app.isPackaged) {
    // Si es el .exe instalado, lee la carpeta compilada
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // Si estás en local programando, usa Vite
    mainWindow.loadURL('http://localhost:8080'); 
  }

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

  const timers = new Map();

  fs.watch(CARPETA_ESCANER, (evento, nombreArchivo) => {
    if (nombreArchivo) {
      const rutaCompleta = path.join(CARPETA_ESCANER, nombreArchivo);
      
      if (!fs.existsSync(rutaCompleta)) return;

      if (timers.has(rutaCompleta)) {
        clearTimeout(timers.get(rutaCompleta));
      }

      const nuevoTemporizador = setTimeout(async () => {
        timers.delete(rutaCompleta); 

        console.log(`\n🚨 DNI Detectado: ${nombreArchivo}. Enviando a IA...`);
        
        try {
          const fileBuffer = fs.readFileSync(rutaCompleta);
          const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
          const formData = new FormData();
          formData.append('file', blob, nombreArchivo);

          const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
          });

          const data = await response.json();
          
          if (data.status === "success") {
            console.log("✅ IA completada! Huésped:", data.data.guestName, data.data.surname);
            
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
        
      }, 1000); 

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

// --- COMUNICACIÓN CON REACT PARA LA CARPETA ---
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecciona la carpeta donde guarda el escáner'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.on('update-scanner-path', (event, nuevaRuta) => {
  console.log(`\n🔄 React ha cambiado la ruta a: ${nuevaRuta}`);
  CARPETA_ESCANER = nuevaRuta;
  iniciarVigilanteEscaner();
});
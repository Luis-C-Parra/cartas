// Código.gs (Google Apps Script)

// 🚨 ID DE TU HOJA DE CÁLCULO (Insertada automáticamente)
const SHEET_ID = '1dFcXBqjVQ2YV2PeT1KMU0Q7-xO-DJWwUDNIcGLIDqr0'; 
const SHEET_NAME = 'Hoja 1'; 

/**
 * Función principal que maneja todas las peticiones POST (login).
 */
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  // Protección contra llamadas de prueba directas
  if (!e || !e.postData || !e.postData.contents) {
    return output.setContent(JSON.stringify({ success: false, message: "Datos no recibidos." }));
  }

  try {
    const data = JSON.parse(e.postData.contents);
    const { username, password } = data; 

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
        return output.setContent(JSON.stringify({ success: false, message: "Error: No se encontró la hoja con el nombre 'Hoja 1'. Revise el nombre." }));
    }

    const values = sheet.getDataRange().getValues();
    const usersData = values.slice(1);
    
    // Fila actual de la hoja (comienza en 2, ya que omitimos el encabezado)
    let rowIndex = 1; 

    // Buscar y verificar el usuario
    for (let i = 0; i < usersData.length; i++) {
      const row = usersData[i];
      const sheetUsername = row[0]; // Columna A
      let sheetPassword = row[1]; // Columna B
      
      rowIndex++; // Aumenta para reflejar la fila actual en la hoja (2, 3, 4...)

      // 1. Verificación de tipo de dato y omisión de filas vacías
      if (!sheetUsername || sheetUsername.toString().trim() === "") {
        continue;
      }
      
      if (sheetPassword !== undefined && sheetPassword !== null) {
          sheetPassword = sheetPassword.toString(); // Asegura que sea String para la comparación
      } else {
          sheetPassword = '';
      }

      // 2. Verificación de credenciales
      if (sheetUsername.toString().toLowerCase() === username.toLowerCase()) {
        
        if (sheetPassword === password) {
          
          // 🚀 LÓGICA DE REGISTRO DE TIEMPO DE INGRESO
          // Escribe la fecha y hora actual en la columna C (índice 3) de la fila encontrada
          const lastLoginCell = sheet.getRange(rowIndex, 3); 
          lastLoginCell.setValue(new Date()); 
          
          // La aplicación web puede tardar 1-2 segundos en este punto,
          // lo que justifica el mensaje de "comparando credenciales".
          
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: "Login exitoso."
          })).setMimeType(ContentService.MimeType.JSON);
        } else {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: "Contraseña incorrecta."
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // Si no se encuentra el usuario
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Usuario no encontrado."
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return output.setContent(JSON.stringify({ 
        success: false, 
        message: "Error interno del servicio. Revise el formato de los datos: " + error.message 
    }));
  }
}
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'MetaAds_ReporteFrecuente.json');
const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));

// 1. Modificar pinData
const manualTrigger = workflow.nodes.find(n => n.name === 'Manual Trigger');
if (workflow.pinData && workflow.pinData['Manual Trigger'] && workflow.pinData['Manual Trigger'].item && workflow.pinData['Manual Trigger'].item[0]) {
  workflow.pinData['Manual Trigger'].item[0].json.client_id = "c557c9d1-8f1a-4d91-9fe0-95e8ac298e64";
}

// 2. Modificar código de preparación
const prepNode = workflow.nodes.find(n => n.name === 'Preparar input');
prepNode.parameters.jsCode = prepNode.parameters.jsCode.replace(
  "const strategy = j.strategy || j.product_angle || '';",
  "const strategy = j.strategy || j.product_angle || '';\n  const client_id = j.client_id || 'c557c9d1-8f1a-4d91-9fe0-95e8ac298e64';"
).replace(
  "out.push({ json: { act_id, date_preset, client_name, slack_channel_id, strategy } });",
  "out.push({ json: { act_id, date_preset, client_name, slack_channel_id, strategy, client_id } });"
);

// 3. Crear nodo Supabase
const supabaseNode = {
  "id": "supabase-save",
  "name": "Supabase - Guardar Reporte",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "position": [1760, 300],
  "parameters": {
    "operation": "insert",
    "table": "reportes_frecuentes",
    "dataMode": "defineBelow",
    "values": {
      "values": [
        { "name": "client_id", "value": "={{ $json.client_id }}" },
        { "name": "period", "value": "={{ $json.period }}" },
        { "name": "metrics", "value": "={{ JSON.stringify($json.metrics) }}" },
        { "name": "ganadores", "value": "={{ JSON.stringify($json.ganadores) }}" },
        { "name": "perdedores", "value": "={{ JSON.stringify($json.perdedores) }}" },
        { "name": "resumen_ia", "value": "={{ $json.resumen_ia }}" }
      ]
    }
  },
  "credentials": {
    "supabaseApi": {
      "id": "",
      "name": "Supabase account"
    }
  }
};

// 4. Mover nodos existentes
const ifSlack = workflow.nodes.find(n => n.name === '¿Enviar a Slack?');
ifSlack.position = [1980, 300];

const slackSend = workflow.nodes.find(n => n.name === 'Slack - Enviar reporte');
slackSend.position = [2200, 200];

const codeOut = workflow.nodes.find(n => n.name === 'Salida (sin Slack)');
codeOut.position = [1760, 400]; // Dejarla colgada del IF más a la derecha

workflow.nodes.push(supabaseNode);

// 5. Ajustar conexiones
workflow.connections['Combinar para Slack'] = {
  "main": [
    [ { "node": "Supabase - Guardar Reporte", "type": "main", "index": 0 } ]
  ]
};

workflow.connections['Supabase - Guardar Reporte'] = {
  "main": [
    [ { "node": "¿Enviar a Slack?", "type": "main", "index": 0 } ]
  ]
};

// Guardar
fs.writeFileSync(file, JSON.stringify(workflow, null, 2), 'utf8');
console.log('Workflow parcheado exitosamente');

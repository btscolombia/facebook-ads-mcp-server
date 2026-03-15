const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'MetaAds_ReporteFrecuente.json');
const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));

const codeOut = workflow.nodes.find(n => n.name === 'Salida (sin Slack)');
codeOut.parameters.jsCode = codeOut.parameters.jsCode.replace(
  "return [{ json: { client_name: d.client_name, metrics: d.metrics, ganadores: d.ganadores, perdedores: d.perdedores, resumen_ia: d.resumen_ia, slack_channel_id: d.slack_channel_id || null } }];",
  "return [{ json: { client_name: d.client_name, client_id: d.client_id, metrics: d.metrics, ganadores: d.ganadores, perdedores: d.perdedores, resumen_ia: d.resumen_ia, slack_channel_id: d.slack_channel_id || null } }];"
);

fs.writeFileSync(file, JSON.stringify(workflow, null, 2), 'utf8');

// Carrega os módulos clássicos em ordem para preservar o estado compartilhado
// entre as áreas da interface sem concentrar toda a aplicação em um único arquivo.
const frontendModules = [
  "01-core.js",
  "02-ui.js",
  "03-import.js",
  "04-navigation.js",
  "05-agencies.js",
  "06-tracking-table.js",
  "07-analytics-score.js",
  "08-analytics-chart.js",
  "09-tracking-data.js",
  "10-logs.js",
  "10-evolution.js",
  "11-events.js",
];

const entrypoint = document.currentScript;

if (!entrypoint) {
  throw new Error("Não foi possível identificar o entry point do frontend.");
}

const modulesBaseUrl = new URL("modules/", entrypoint.src);
const frontendVersion = "20260925-60";

function loadModule(index) {
  if (index >= frontendModules.length) {
    return;
  }

  const moduleName = frontendModules[index];
  const script = document.createElement("script");
  const moduleUrl = new URL(moduleName, modulesBaseUrl);
  moduleUrl.searchParams.set("v", frontendVersion);
  script.src = moduleUrl.href;
  script.onload = () => loadModule(index + 1);
  script.onerror = () => {
    console.error(`Falha ao carregar o módulo frontend: ${moduleName}`);
  };
  document.head.appendChild(script);
}

loadModule(0);

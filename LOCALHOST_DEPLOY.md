# Deploy local sin Node (VS Code)

Este proyecto puede ejecutarse en `localhost` sin `npm` ni `node` usando la interfaz de VS Code.

## Inicio automatico al abrir VS Code

- La tarea `Dashboard: Servir dist en localhost` esta configurada con `runOn: folderOpen`.
- En el workspace se habilito `task.allowAutomaticTasks: on`.
- Resultado: al abrir esta carpeta en VS Code, el servidor se levanta automaticamente en `http://localhost:5501`.

## Configuracion de entorno (obligatoria para Supabase)

1. Crea un archivo `.env` en la raiz del proyecto tomando `.env.example` como base.
2. Completa `VITE_SUPABASE_LOCKERS_URL` y `VITE_SUPABASE_LOCKERS_ANON_KEY`.
3. Si usas una base distinta para penalidades, completa `VITE_SUPABASE_PENALIDADES_*`.
4. Ejecuta `npm run build` para regenerar `dist` con la nueva configuracion.

## Opcion 1: Ejecutar y depurar en navegador

1. Abre la vista **Run and Debug** en VS Code (`Ctrl+Shift+D`).
2. Elige `Dashboard localhost (Edge)` o `Dashboard localhost (Chrome)`.
3. Presiona **Start Debugging** (`F5`).

VS Code levantara un servidor local en `http://localhost:5501` usando `scripts/serve-dist.ps1`.

## Opcion 2: Solo levantar servidor local

1. Abre **Terminal > Run Task...**
2. Ejecuta la tarea `Dashboard: Servir dist en localhost`.
3. Abre `http://localhost:5501` en tu navegador.

## Detener servidor

- Si lo iniciaste con tarea de VS Code, usa **Terminal > Terminate Task**.
- Si lo iniciaste en terminal, presiona `Ctrl+C`.

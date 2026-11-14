// Borrador con el que se está trabajando entre el paso 1 y el paso 2. Vive en memoria: si el
// propietario recarga el paso 2, la página lo vuelve a pedir al backend.
let currentDraft = null;

export function setDraft(draft) {
  currentDraft = draft;
}

export function getCurrentDraft() {
  return currentDraft;
}

export function clearDraft() {
  currentDraft = null;
}

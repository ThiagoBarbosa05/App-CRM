const STORAGE_KEY = "pdvCurrentUnitId";

export function getPdvCurrentUnitId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setPdvCurrentUnitId(unitId: string): void {
  localStorage.setItem(STORAGE_KEY, unitId);
  window.dispatchEvent(new CustomEvent("pdvUnitChanged", { detail: unitId }));
}

export function clearPdvCurrentUnitId(): void {
  localStorage.removeItem(STORAGE_KEY);
}

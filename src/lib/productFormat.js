// Devolver Number(value) a secas es una trampa: si el valor no es numerico
// Number devuelve NaN, que no es null y no es < 0, asi que se escapa de todas
// las comparaciones contra null. NaN termina guardado en Firestore y ahi
// revienta toda la operacion. Por eso se filtra aca y no en cada llamador.
export const normalizeNumber = (value) => {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const isLowStock = (stock, minStock) => {
  const stockNumber = normalizeNumber(stock)
  const min = normalizeNumber(minStock)
  return stockNumber !== null && min !== null && stockNumber <= min
}
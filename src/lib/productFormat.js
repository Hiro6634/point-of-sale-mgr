export const normalizeNumber = (value) =>
  value === '' || value == null ? null : Number(value)

export const isLowStock = (stock, minStock) => {
  const stockNumber = normalizeNumber(stock)
  const min = normalizeNumber(minStock)
  return stockNumber !== null && min !== null && stockNumber <= min
}
import { Link } from 'react-router-dom'

export default function HelpPage() {
  return (
    <div className="max-w-xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-neutral-900">Punto de Venta</h1>
      <ul className="list-disc space-y-2 pl-5 text-neutral-700">
        <li>
          Tocando el ícono de arriba a la izquierda se retorna a la pantalla
          principal.
        </li>
        <li>
          En la parte superior tocando el nombre del producto se suma a la
          venta.
        </li>
        <li>
          Cuando se desea eliminar un artículo, presionar la cruz al final de la
          línea.
        </li>
        <li>
          Antes de imprimir la venta se hace una confirmación; desde allí se
          puede volver para EDITAR, CANCELAR la orden o CONFIRMARLA.
        </li>
      </ul>
      <Link to="/" className="mt-6 inline-block text-sm font-semibold uppercase">
        Volver
      </Link>
    </div>
  )
}
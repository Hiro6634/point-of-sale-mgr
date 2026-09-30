// Toast de las dos paginas. Los de exito se van solos; los de error quedan
// hasta que se los clickee, porque un "no se puede restar mas de lo que hay"
// que desaparece solo es un error que el operador no llega a leer.
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null
  const isSuccess = toast.type === 'success'
  return (
    <div
      role="status"
      onClick={onDismiss}
      className={`fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg ${
        isSuccess ? 'bg-green-600' : 'cursor-pointer bg-red-600'
      }`}
    >
      {toast.message}
      {!isSuccess && <span className="ml-3 opacity-70">x</span>}
    </div>
  )
}
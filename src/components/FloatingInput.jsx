import { useState } from 'react'

const floatingLabelStyles = {
  input:
    'h-14 w-full border-b border-neutral-400 bg-transparent text-lg text-neutral-900 outline-none transition-colors focus:border-neutral-900 focus:bg-neutral-900/[0.03] dark:border-neutral-600 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:bg-neutral-100/10',
  label:
    'pointer-events-none absolute left-0 top-4 text-lg text-neutral-500 transition-all duration-300 ease-in dark:text-neutral-400',
  labelFloat:
    'pointer-events-none absolute left-0 top-0 text-[11px] text-neutral-900 dark:text-neutral-100',
}

export default function FloatingInput({
  label,
  type = 'text',
  name,
  value,
  onChange,
  required = false,
  autoComplete,
}) {
  const [focused, setFocused] = useState(false)
  const isFloating = focused || value.length > 0

  return (
    <div className="relative mb-5 w-full">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={
          floatingLabelStyles.input +
          (type === 'password' ? ' tracking-[0.3em]' : '')
        }
      />
      <label className={isFloating ? floatingLabelStyles.labelFloat : floatingLabelStyles.label}>
        {label}
      </label>
    </div>
  )
}
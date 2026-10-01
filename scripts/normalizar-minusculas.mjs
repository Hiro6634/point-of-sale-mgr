// Migracion de env/dev a minusculas en los valores guardados.
//
// Que quede claro el alcance, porque es la parte importante: esto NO cambia los
// identificadores de documento. Solo normaliza los valores de los campos.
// Los ids son claves internas y no se muestran en ninguna pantalla, y
// cambiarlos obligaria a recrear cada documento de categoria y reescribir el
// campo category de cada producto. El valor de categoria guardado ya se
// compara con toLowerCase() en la app, asi que un id en mayusculas convive sin
// problema con un category en minusculas.
//
// Tampoco toca stockMoves ni tickets: son registros de lo que paso, no
// configuracion. Reescribir la historia para que se vea prolija no vale la pena.
//
// Uso:
//   node scripts/normalizar-minusculas.mjs            -> simulacion, no escribe
//   node scripts/normalizar-minusculas.mjs --apply    -> escribe
//
// Las credenciales se leen del entorno y no se hardcodean ni se committean:
//   $env:MIGRATION_EMAIL = "..."; $env:MIGRATION_PASSWORD = "..."

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  writeBatch,
} from 'firebase/firestore'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')

// Parser de .env.local a mano para no agregar una dependencia por esto.
const envLocal = {}
try {
  for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match) envLocal[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
} catch {
  console.error('No se pudo leer .env.local')
  process.exit(1)
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]
const missing = required.filter((key) => !envLocal[key])
if (missing.length > 0) {
  console.error(`Faltan variables en .env.local: ${missing.join(', ')}`)
  process.exit(1)
}

const email = process.env.MIGRATION_EMAIL
const password = process.env.MIGRATION_PASSWORD
if (!email || !password) {
  console.error('Faltan MIGRATION_EMAIL y MIGRATION_PASSWORD en el entorno.')
  process.exit(1)
}

const app = initializeApp({
  apiKey: envLocal.VITE_FIREBASE_API_KEY,
  authDomain: envLocal.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envLocal.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envLocal.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envLocal.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envLocal.VITE_FIREBASE_APP_ID,
  measurementId: envLocal.VITE_FIREBASE_MEASUREMENT_ID,
})

await signInWithEmailAndPassword(getAuth(app), email, password)

const db = getFirestore(app)

const segment = (name) => `env/${envLocal.VITE_FIREBASE_DB_ENV ?? 'dev'}/${name}`
const show = (value) => String(value ?? '').toUpperCase()

// Normaliza solo strings. Cualquier otra cosa se reporta y se deja como esta:
// un numero o un booleano que estuviera donde va un nombre es un problema de
// datos que hay que ver a mano, no algo que esta migracion deba inventar.
const normalize = (value) => {
  if (typeof value !== 'string') return null
  return value.trim().toLowerCase()
}

const operations = []
const skipped = []

const categoriesSnapshot = await getDocs(collection(db, segment('categories')))
for (const categoryDoc of categoriesSnapshot.docs) {
  const data = categoryDoc.data()
  const name = normalize(data.name)
  if (name === null) {
    if (data.name != null) skipped.push(`categoria ${categoryDoc.id}: name no es texto`)
    continue
  }
  if (name !== data.name) {
    operations.push({
      ref: doc(db, segment('categories'), categoryDoc.id),
      label: `categoria ${categoryDoc.id}: "${data.name}" -> "${name}"`,
      changes: { name },
    })
  }
}

const productsSnapshot = await getDocs(collection(db, segment('products')))
for (const productDoc of productsSnapshot.docs) {
  const data = productDoc.data()
  const changes = {}

  const name = normalize(data.name)
  if (name !== null && name !== data.name) changes.name = name
  const category = normalize(data.category)
  if (category !== null && category !== data.category) changes.category = category

  if (Object.keys(changes).length > 0) {
    operations.push({
      ref: doc(db, segment('products'), productDoc.id),
      label: `producto ${productDoc.id} (${show(data.name)}): ${JSON.stringify(changes)}`,
      changes,
    })
  }
}

console.log(`\nProductos revisados: ${productsSnapshot.size}`)
console.log(`Categorias revisadas: ${categoriesSnapshot.size}`)
console.log(`Cambios pendientes: ${operations.length}`)
for (const operation of operations) console.log(`  - ${operation.label}`)

if (skipped.length > 0) {
  console.log('\nSin tocar, revisar a mano:')
  for (const item of skipped) console.log(`  - ${item}`)
}

if (operations.length === 0) {
  console.log('\nNo hay nada que migrar.\n')
  process.exit(0)
}

if (!apply) {
  console.log('\nSimulacion. Correr con --apply para escribir.\n')
  process.exit(0)
}

// Firestore admite 500 escrituras por lote. Va bastante por debajo del limite.
const CHUNK = 400
let written = 0
for (let index = 0; index < operations.length; index += CHUNK) {
  const chunk = operations.slice(index, index + CHUNK)
  const batch = writeBatch(db)
  for (const operation of chunk) batch.update(operation.ref, operation.changes)
  await batch.commit()
  written += chunk.length
  console.log(`  ${written}/${operations.length}`)
}

console.log(`\nListo: ${written} documentos actualizados.\n`)
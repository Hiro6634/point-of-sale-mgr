export const DB_ENV = import.meta.env.VITE_FIREBASE_DB_ENV ?? 'dev'

export const dbCollectionPath = (segment) => `env/${DB_ENV}/${segment}`

export default dbCollectionPath
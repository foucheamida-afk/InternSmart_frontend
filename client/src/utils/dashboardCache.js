export const getDashboardCache = (key) => {
  try {
    const item = sessionStorage.getItem(`cache_${key}`)
    return item ? JSON.parse(item) : null
  } catch {
    return null
  }
}

export const setDashboardCache = (key, data) => {
  try {
    sessionStorage.setItem(`cache_${key}`, JSON.stringify(data))
  } catch {
    // Ignore storage quota errors
  }
}

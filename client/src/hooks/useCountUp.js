import { useEffect, useState, useRef } from 'react'

function useCountUp(target, duration = 800, startOnMount = true) {
  const [count, setCount] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!startOnMount || started.current) return
    if (target === null || target === undefined || Number.isNaN(target)) return

    started.current = true
    const startTime = performance.now()
    const startValue = 0

    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startValue + (target - startValue) * eased)
      setCount(current)

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        setCount(target)
      }
    }

    requestAnimationFrame(step)
  }, [target, duration, startOnMount])

  return count
}

export default useCountUp

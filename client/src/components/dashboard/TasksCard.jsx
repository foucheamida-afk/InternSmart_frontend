import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle } from 'lucide-react'

export default function TasksCard() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Improve conclusion section', date: 'May 18', completed: true },
    { id: 2, name: 'Address AI suggestions', date: 'May 20', completed: true },
    { id: 3, name: 'Submit final version', date: 'May 30', completed: false },
  ])

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  return (
    <div className="card tasks-card">
      <div className="card-header">
        <h3 className="card-title">Tasks</h3>
        <button className="card-action cursor-pointer" onClick={() => navigate('/my-reports')}>
          View all
        </button>
      </div>

      <div className="tasks-list">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id)}
            className={`task-item ${task.completed ? 'completed' : 'pending'} cursor-pointer select-none`}
          >
            <div className="task-checkbox">
              {task.completed ? (
                <CheckCircle2 size={20} className="text-orange-400" />
              ) : (
                <Circle size={20} />
              )}
            </div>
            <div className="task-content">
              <span className="task-name">{task.name}</span>
            </div>
            <span className="task-date">{task.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

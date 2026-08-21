import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Video, CheckCircle2, PhoneOff, Mic, MicOff, Camera, CameraOff, X } from 'lucide-react'

export default function UpcomingMeeting() {
  const navigate = useNavigate()
  const [isInCall, setIsInCall] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [rescheduled, setRescheduled] = useState(false)

  return (
    <>
      <div className="card upcoming-meeting-card">
        <div className="card-header">
          <h3 className="card-title">Upcoming Meeting</h3>
          <button className="card-action cursor-pointer" onClick={() => navigate('/my-reports')}>
            View all
          </button>
        </div>

        <div className="meeting-content">
          <div className="meeting-date-block">
            <div className="meeting-month">MAY</div>
            <div className="meeting-day">20</div>
            <div className="meeting-weekday">Tue</div>
          </div>

          <div className="meeting-details">
            <h4 className="meeting-title">Meeting with Prof. Marie Dupont</h4>

            <div className="meeting-time">
              <Calendar size={16} />
              <span>10:00 AM – 11:00 AM</span>
            </div>

            <div className="meeting-tags">
              <span className="meeting-tag">Online meeting</span>
              <span className="meeting-tag">Report Review</span>
            </div>

            {rescheduled && (
              <div className="text-xs text-orange-300 bg-orange-500/10 border border-orange-400/20 rounded-lg p-2 mt-2">
                ✓ Reschedule request sent to supervisor.
              </div>
            )}

            <div className="meeting-buttons">
              <button
                className="btn btn-primary cursor-pointer flex items-center gap-2"
                onClick={() => setIsInCall(true)}
              >
                <Video size={16} />
                Join Meeting
              </button>
              <button
                className="btn btn-secondary cursor-pointer"
                onClick={() => setRescheduled(true)}
              >
                Reschedule
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Call Modal */}
      {isInCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0d1419] p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Online Review Session</h3>
                <p className="text-xs text-white/50">Host: Prof. Marie Dupont • 10:00 AM - 11:00 AM</p>
              </div>
              <button
                onClick={() => setIsInCall(false)}
                className="rounded-full p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative h-64 sm:h-80 rounded-xl bg-[#06090c] border border-white/10 flex flex-col items-center justify-center overflow-hidden mb-6">
              {videoOn ? (
                <div className="flex flex-col items-center text-center p-4">
                  <div className="h-20 w-20 rounded-full bg-linear-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-2xl font-bold text-white mb-3 shadow-lg">
                    MD
                  </div>
                  <p className="text-base font-medium text-white">Prof. Marie Dupont (Connected)</p>
                  <span className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span> Screen sharing ready
                  </span>
                </div>
              ) : (
                <p className="text-sm text-white/40">Camera is turned off</p>
              )}

              {/* Student small preview PIP */}
              <div className="absolute bottom-3 right-3 h-24 w-32 rounded-lg bg-[#151c22] border border-white/20 flex items-center justify-center text-xs text-white/80 shadow-md">
                <span>You (Anita)</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setMicOn(!micOn)}
                className={`p-3.5 rounded-full border transition cursor-pointer ${
                  micOn ? 'bg-white/10 border-white/20 text-white' : 'bg-red-500/20 border-red-500/40 text-red-300'
                }`}
                title={micOn ? 'Mute microphone' : 'Unmute microphone'}
              >
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              <button
                onClick={() => setVideoOn(!videoOn)}
                className={`p-3.5 rounded-full border transition cursor-pointer ${
                  videoOn ? 'bg-white/10 border-white/20 text-white' : 'bg-red-500/20 border-red-500/40 text-red-300'
                }`}
                title={videoOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoOn ? <Camera size={20} /> : <CameraOff size={20} />}
              </button>

              <button
                onClick={() => setIsInCall(false)}
                className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center gap-2 transition cursor-pointer shadow-lg shadow-red-600/30"
              >
                <PhoneOff size={18} />
                Leave Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

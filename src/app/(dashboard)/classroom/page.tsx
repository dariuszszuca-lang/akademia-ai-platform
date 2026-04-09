export default function ClassroomPage() {
  const courses = [
    { id: 1, title: "Moduł 1: Fundamenty AI", lessons: 5, duration: "2h 30min", progress: 0, emoji: "🧠" },
    { id: 2, title: "Moduł 2: Asystenci AI w praktyce", lessons: 6, duration: "3h", progress: 0, emoji: "🤖" },
    { id: 3, title: "Moduł 3: Automatyzacja procesów", lessons: 4, duration: "2h", progress: 0, emoji: "⚡" },
    { id: 4, title: "Moduł 4: AI w sprzedaży nieruchomości", lessons: 5, duration: "2h 45min", progress: 0, emoji: "🏠" },
    { id: 5, title: "Moduł 5: Twoja strona z AI", lessons: 3, duration: "1h 30min", progress: 0, emoji: "🌐" },
  ];

  return (
    <div className="max-w-4xl">
      <div className="space-y-3">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md hover:border-gold/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-slate-light flex items-center justify-center text-2xl flex-shrink-0">
                {course.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-navy group-hover:text-gold-dark transition-colors">
                  {course.title}
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {course.lessons} lekcji · {course.duration}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-24 h-2 bg-slate-light rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8">{course.progress}%</span>
                <svg className="w-5 h-5 text-gray-300 group-hover:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

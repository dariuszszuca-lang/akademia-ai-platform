export default function ClassroomPage() {
  const courses = [
    { id: 1, title: "Moduł 1: Fundamenty AI", lessons: 5, duration: "2h 30min", progress: 0 },
    { id: 2, title: "Moduł 2: Asystenci AI w praktyce", lessons: 6, duration: "3h", progress: 0 },
    { id: 3, title: "Moduł 3: Automatyzacja procesów", lessons: 4, duration: "2h", progress: 0 },
    { id: 4, title: "Moduł 4: AI w sprzedaży nieruchomości", lessons: 5, duration: "2h 45min", progress: 0 },
    { id: 5, title: "Moduł 5: Twoja strona z AI", lessons: 3, duration: "1h 30min", progress: 0 },
  ];

  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-navy mb-2">Classroom</h2>
      <p className="text-gray-500 mb-8">Twoje kursy i materiały szkoleniowe</p>

      <div className="space-y-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md hover:border-gold/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gold/10 flex items-center justify-center text-gold font-heading font-bold text-lg group-hover:bg-gold/20 transition-colors">
                  {course.id}
                </div>
                <div>
                  <h3 className="font-semibold text-navy group-hover:text-gold-dark transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {course.lessons} lekcji &middot; {course.duration}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-sm font-medium text-gray-500">{course.progress}%</span>
                </div>
                <div className="w-32 h-2 bg-slate-light rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gold rounded-full transition-all"
                    style={{ width: `${course.progress}%` }}
                  />
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-gold transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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

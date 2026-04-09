export default function MembersPage() {
  return (
    <div>
      <h2 className="font-heading text-2xl font-semibold text-navy mb-2">Członkowie</h2>
      <p className="text-gray-500 mb-8">Uczestnicy warsztatów Akademia AI</p>

      <div className="bg-card rounded-xl border border-border p-12 text-center shadow-sm">
        <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <h3 className="font-heading text-lg font-semibold text-navy mb-2">Lista członków</h3>
        <p className="text-gray-500 text-sm">Członkowie pojawią się po uruchomieniu pierwszej edycji warsztatów</p>
      </div>
    </div>
  );
}

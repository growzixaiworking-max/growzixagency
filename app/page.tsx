'use client';



export default function Home() {
  const { currentUser, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-[9999]">
        <Loader />
      </div>
    );
  }

  if (!currentUser) return <LoginPage />;
  
  if (currentUser.role === 'employee') {
    return <EmployeePortal />;
  }

  return <MainApp />;
}

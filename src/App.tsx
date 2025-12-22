import { useState } from 'react';
import Navigation from './components/Navigation';
import CreateProject from './components/CreateProject';
import ViewBudgets from './components/ViewBudgets';
import CreateInvoice from './components/CreateInvoice';
import ViewInvoices from './components/ViewInvoices';
import RespondEmail from './components/RespondEmail';
import ManageServices from './components/ManageServices';

function App() {
  const [currentPage, setCurrentPage] = useState('create');

  const renderPage = () => {
    switch (currentPage) {
      case 'create':
        return <CreateProject />;
      case 'budgets':
        return <ViewBudgets />;
      case 'invoice':
        return <CreateInvoice />;
      case 'invoices':
        return <ViewInvoices />;
      case 'respond':
        return <RespondEmail />;
      case 'services':
        return <ManageServices />;
      default:
        return <CreateProject />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="py-8 px-4 sm:px-6 lg:px-8">{renderPage()}</div>
    </div>
  );
}

export default App;

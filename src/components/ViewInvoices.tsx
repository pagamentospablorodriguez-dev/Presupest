import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, User, Mail, DollarSign, AlertCircle } from 'lucide-react';

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: number;
  project_name: string;
  total_price: string;
  observations: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  clients?: any;
}

export default function ViewInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        clients (*)
      `)
      .order('created_at', { ascending: false });

    if (data) setInvoices(data as Invoice[]);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
    };
    const labels = {
      pending: 'Pendiente',
      sent: 'Enviada',
      paid: 'Pagada',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando facturas...</div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-lg p-12 text-center">
        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Ninguna factura creada
        </h3>
        <p className="text-gray-600">
          Crea tu primera factura usando el botón "Nueva Factura"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Facturas Enviadas
        </h2>
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="border border-gray-200 rounded-lg p-6 hover:border-green-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User className="h-5 w-5 mr-2 text-gray-500" />
                    {invoice.clients?.name}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-2" />
                    {invoice.clients?.email}
                  </p>
                </div>
                {getStatusBadge(invoice.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center text-sm text-gray-700">
                  <span className="font-medium mr-2">Factura Nº:</span>
                  {invoice.invoice_number}/025
                </div>
                {invoice.project_name && (
                  <div className="flex items-center text-sm text-gray-700">
                    <span className="font-medium mr-2">Proyecto:</span>
                    {invoice.project_name}
                  </div>
                )}
              </div>

              {invoice.observations && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">{invoice.observations}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  {formatDate(invoice.created_at)}
                </div>
                <div className="flex items-center text-lg font-bold text-gray-900">
                  <DollarSign className="h-5 w-5 mr-1 text-green-600" />
                  {parseFloat(invoice.total_price).toFixed(2)}€
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

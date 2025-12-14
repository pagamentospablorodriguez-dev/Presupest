import { useState, useEffect } from 'react';
import { supabase, Budget } from '../lib/supabase';
import { Send, Loader2, CheckCircle } from 'lucide-react';

export default function RespondEmail() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSentBudgets();
  }, []);

  const loadSentBudgets = async () => {
    const { data } = await supabase
      .from('budgets')
      .select(`
        *,
        clients (*),
        services (*)
      `)
      .eq('status', 'sent')
      .order('created_at', { ascending: false });

    if (data) setBudgets(data as Budget[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);
    if (!selectedBudget) {
      setError('Presupuesto no encontrado');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/respond-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budgetId: selectedBudgetId,
          clientEmail: selectedBudget.clients?.email,
          clientMessage: clientMessage,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setClientMessage('');
        setSelectedBudgetId('');
      } else {
        setError(result.error || 'Error al enviar respuesta');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Responder Email Automáticamente
        </h2>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Cómo funciona:</strong> Selecciona un presupuesto enviado e introduce
            el mensaje que el cliente ha enviado por email. El sistema generará
            automáticamente una respuesta personalizada y la enviará al cliente.
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">
              ¡Respuesta enviada con éxito!
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Presupuesto *
            </label>
            <select
              required
              value={selectedBudgetId}
              onChange={(e) => setSelectedBudgetId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Elige un presupuesto</option>
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.clients?.name} - {budget.services?.name} - {budget.total_price}€
                </option>
              ))}
            </select>
          </div>

          {selectedBudget && (
            <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">
                Detalles del Presupuesto
              </h3>
              <div className="space-y-1 text-sm text-gray-700">
                <p>
                  <strong>Cliente:</strong> {selectedBudget.clients?.name}
                </p>
                <p>
                  <strong>Email:</strong> {selectedBudget.clients?.email}
                </p>
                <p>
                  <strong>Servicio:</strong> {selectedBudget.services?.name}
                </p>
                <p>
                  <strong>Importe Total:</strong> {parseFloat(selectedBudget.total_price).toFixed(2)}€
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje del Cliente *
            </label>
            <textarea
              required
              rows={6}
              value={clientMessage}
              onChange={(e) => setClientMessage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Pega aquí el email que el cliente ha enviado. Por ejemplo: 'Me parece muy caro, ¿puedes hacerlo por menos?'"
            />
            <p className="mt-1 text-xs text-gray-500">
              El sistema detectará automáticamente si el cliente se queja del precio
              y generará una respuesta apropiada.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !selectedBudgetId}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generando respuesta...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Generar y Enviar Respuesta</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

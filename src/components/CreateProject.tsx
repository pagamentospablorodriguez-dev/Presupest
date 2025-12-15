import { useState, useEffect } from 'react';
import { supabase, Service } from '../lib/supabase';
import { Send, Loader2, CheckCircle, Plus, Trash2 } from 'lucide-react';

interface BudgetItem {
  serviceId: string;
  quantity: string;
  difficultyFactor: string;
  customNotes: string;
}

export default function CreateProject() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectName: 'Reforma integral',
    distanceKm: '',
    observations: '',
  });

  const [items, setItems] = useState<BudgetItem[]>([
    { serviceId: '', quantity: '', difficultyFactor: '1.0', customNotes: '' },
  ]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('name');

    if (data) setServices(data);
  };

  const addItem = () => {
    setItems([
      ...items,
      { serviceId: '', quantity: '', difficultyFactor: '1.0', customNotes: '' },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (
    index: number,
    field: keyof BudgetItem,
    value: string
  ) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    let total = 0;

    items.forEach((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (service && item.quantity && item.difficultyFactor) {
        const base = parseFloat(service.base_price);
        const qty = parseFloat(item.quantity);
        const diff = parseFloat(item.difficultyFactor);
        total += base * qty * diff;
      }
    });

    const km = parseFloat(formData.distanceKm) || 0;
    const distanceFee = km > 15 ? (km - 15) * 3 : 0;

    return (total + distanceFee).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(
        '/.netlify/functions/generate-project-budget',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            distanceKm: parseFloat(formData.distanceKm),
            items: items.map((item) => ({
              serviceId: item.serviceId,
              quantity: parseFloat(item.quantity),
              difficultyFactor: parseFloat(item.difficultyFactor),
              customNotes: item.customNotes,
            })),
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setFormData({
          clientName: '',
          clientEmail: '',
          clientPhone: '',
          projectName: 'Reforma integral',
          distanceKm: '',
          observations: '',
        });
        setItems([
          {
            serviceId: '',
            quantity: '',
            difficultyFactor: '1.0',
            customNotes: '',
          },
        ]);
      } else {
        setError(result.error || 'Error al generar presupuesto');
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {success && (
        <div className="mb-4 p-4 bg-green-50 border rounded">
          <CheckCircle className="inline mr-2 text-green-600" />
          Presupuesto enviado correctamente
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border rounded text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FORM */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-md"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" /> Generando...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Send /> Enviar presupuesto ({calculateTotal()}€)
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

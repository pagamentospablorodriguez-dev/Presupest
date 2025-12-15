import { useState, useEffect } from 'react';
import { supabase, Service } from '../lib/supabase';
import { Send, Loader2, CheckCircle, Plus, Trash2 } from 'lucide-react';

interface BudgetItem {
  serviceId: string;
  quantity: string;
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
    globalDifficulty: '1.0',
    observations: '',
  });

  const [items, setItems] = useState<BudgetItem[]>([
    { serviceId: '', quantity: '', customNotes: '' },
  ]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');

    if (!error && data) {
      setServices(data);
    }
  };

  const addItem = () => {
    setItems([...items, { serviceId: '', quantity: '', customNotes: '' }]);
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
    let subtotal = 0;

    items.forEach((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (service && item.quantity) {
        subtotal +=
          parseFloat(service.base_price) * parseFloat(item.quantity);
      }
    });

    const distanceKm = parseFloat(formData.distanceKm) || 0;
    const distanceFee = distanceKm > 15 ? (distanceKm - 15) * 3 : 0;
    const difficulty = parseFloat(formData.globalDifficulty) || 1;

    return ((subtotal + distanceFee) * difficulty).toFixed(2);
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
            globalDifficulty: parseFloat(formData.globalDifficulty),
            items: items.map((item) => ({
              serviceId: item.serviceId,
              quantity: parseFloat(item.quantity),
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
          globalDifficulty: '1.0',
          observations: '',
        });
        setItems([{ serviceId: '', quantity: '', customNotes: '' }]);
      } else {
        setError(result.error || 'Error al generar presupuesto');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
        <h2 className="text-3xl font-bold">
          Presupuesto Profesional Multi-Servicio
        </h2>
        <p className="mt-2 text-blue-100">
          Un solo presupuesto, todos los servicios, un solo email.
        </p>
      </div>

      <div className="bg-white shadow-md rounded-b-lg p-6">
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">
              Presupuesto enviado con éxito
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CLIENTE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              required
              placeholder="Nombre del cliente"
              value={formData.clientName}
              onChange={(e) =>
                setFormData({ ...formData, clientName: e.target.value })
              }
              className="px-4 py-2 border rounded-md"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={formData.clientEmail}
              onChange={(e) =>
                setFormData({ ...formData, clientEmail: e.target.value })
              }
              className="px-4 py-2 border rounded-md"
            />
            <input
              placeholder="Teléfono"
              value={formData.clientPhone}
              onChange={(e) =>
                setFormData({ ...formData, clientPhone: e.target.value })
              }
              className="px-4 py-2 border rounded-md"
            />
          </div>

          {/* SERVICIOS */}
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-3 items-end"
            >
              <select
                required
                className="col-span-5 px-3 py-2 border rounded-md"
                value={item.serviceId}
                onChange={(e) =>
                  updateItem(index, 'serviceId', e.target.value)
                }
              >
                <option value="">Servicio</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} – {s.base_price}€/{s.unit}
                  </option>
                ))}
              </select>

              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="col-span-2 px-3 py-2 border rounded-md"
                placeholder="Cantidad"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(index, 'quantity', e.target.value)
                }
              />

              <input
                className="col-span-4 px-3 py-2 border rounded-md"
                placeholder="Nota"
                value={item.customNotes}
                onChange={(e) =>
                  updateItem(index, 'customNotes', e.target.value)
                }
              />

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="col-span-1 text-red-600"
                >
                  <Trash2 />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 text-green-600"
          >
            <Plus /> Añadir servicio
          </button>

          <div className="text-right text-2xl font-bold">
            TOTAL: {calculateTotal()}€
          </div>

          <button
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md flex justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Send />}
            Generar y enviar presupuesto
          </button>
        </form>
      </div>
    </div>
  );
}

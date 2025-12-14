import { useState, useEffect } from 'react';
import { supabase, Service } from '../lib/supabase';
import { Send, Loader2, CheckCircle } from 'lucide-react';

export default function CreateBudget() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    serviceId: '',
    quantity: '',
    distanceKm: '',
    difficultyFactor: '1.0',
    description: '',
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    if (data) setServices(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/.netlify/functions/generate-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: formData.clientName,
          clientEmail: formData.clientEmail,
          clientPhone: formData.clientPhone,
          serviceId: formData.serviceId,
          quantity: parseFloat(formData.quantity),
          distanceKm: parseFloat(formData.distanceKm),
          difficultyFactor: parseFloat(formData.difficultyFactor),
          description: formData.description,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setFormData({
          clientName: '',
          clientEmail: '',
          clientPhone: '',
          serviceId: '',
          quantity: '',
          distanceKm: '',
          difficultyFactor: '1.0',
          description: '',
        });
      } else {
        setError(result.error || 'Error al generar presupuesto');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const selectedService = services.find((s) => s.id === formData.serviceId);
  const calculateEstimate = () => {
    if (!selectedService || !formData.quantity) return 0;
    const basePrice = parseFloat(selectedService.base_price);
    const quantity = parseFloat(formData.quantity);
    const distanceKm = parseFloat(formData.distanceKm) || 0;
    const distanceFee = distanceKm > 15 ? (distanceKm - 15) * 3 : 0;
    const difficultyFactor = parseFloat(formData.difficultyFactor) || 1.0;
    return ((basePrice * quantity + distanceFee) * difficultyFactor).toFixed(2);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Crear Nuevo Presupuesto
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">
              ¡Presupuesto generado y enviado con éxito!
            </span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                value={formData.clientName}
                onChange={(e) =>
                  setFormData({ ...formData, clientName: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Juan García"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email del Cliente *
              </label>
              <input
                type="email"
                required
                value={formData.clientEmail}
                onChange={(e) =>
                  setFormData({ ...formData, clientEmail: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="juan@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) =>
                  setFormData({ ...formData, clientPhone: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+34 666 777 888"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Servicio *
              </label>
              <select
                required
                value={formData.serviceId}
                onChange={(e) =>
                  setFormData({ ...formData, serviceId: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona un servicio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.base_price}€/{service.unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad ({selectedService?.unit || 'unidad'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Distancia (km) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={formData.distanceKm}
                onChange={(e) =>
                  setFormData({ ...formData, distanceKm: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Gastos de desplazamiento: 3€/km por encima de 15km
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Factor de Dificultad *
              </label>
              <select
                required
                value={formData.difficultyFactor}
                onChange={(e) =>
                  setFormData({ ...formData, difficultyFactor: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1.0">Normal (1.0x)</option>
                <option value="1.2">Dificultad media (1.2x)</option>
                <option value="1.5">Dificultad alta (1.5x)</option>
                <option value="2.0">Muy difícil (2.0x)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimación del Importe
              </label>
              <div className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50">
                <span className="text-lg font-bold text-gray-900">
                  {calculateEstimate()}€
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Detalles adicionales sobre el servicio..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generando y enviando...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Generar y Enviar Presupuesto</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

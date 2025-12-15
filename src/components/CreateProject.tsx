// src/components/CreateProject.tsx
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
    const { data } = await supabase.from('services').select('*').order('name');
    if (data) setServices(data);
  };

  const addItem = () => {
    setItems([...items, { serviceId: '', quantity: '', difficultyFactor: '1.0', customNotes: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof BudgetItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    let total = 0;
    items.forEach((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (service && item.quantity && item.difficultyFactor) {
        const basePrice = Number(service.base_price);
        const quantity = Number(item.quantity);
        const difficulty = Number(item.difficultyFactor);
        total += basePrice * quantity * difficulty;
      }
    });

    const distanceKm = Number(formData.distanceKm) || 0;
    const distanceFee = distanceKm > 15 ? (distanceKm - 15) * 3 : 0;

    return (total + distanceFee).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/.netlify/functions/generate-project-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          distanceKm: Number(formData.distanceKm),
          items: items.map((item) => ({
            serviceId: item.serviceId,
            quantity: Number(item.quantity),
            difficultyFactor: Number(item.difficultyFactor),
            customNotes: item.customNotes,
          })),
        }),
      });

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
        setItems([{ serviceId: '', quantity: '', difficultyFactor: '1.0', customNotes: '' }]);
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
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-t-lg shadow-lg">
        <h2 className="text-3xl font-bold mb-3">
          🏗️ Presupuesto - Sistema Profesional de Presupuestos
        </h2>
        <p className="text-lg text-blue-50 leading-relaxed">
          Crea presupuestos completos post-visita técnica en <strong>2 minutos</strong> en lugar de 30.
          Todos los servicios de la obra en <strong>un solo email profesional</strong>.
          <span className="block mt-2 font-semibold text-yellow-300">
            Ahorra tiempo, gana profesionalidad, cierra más obras.
          </span>
        </p>
      </div>

      <div className="bg-white shadow-md rounded-b-lg p-6">
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
          {/* Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Cliente *
              </label>
              <input
                type="text"
                required
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Juan García"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.clientEmail}
                onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="+34 666 777 888"
              />
            </div>
          </div>

          {/* Proyecto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Proyecto *
              </label>
              <input
                type="text"
                required
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Reforma integral vivienda"
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
                onChange={(e) => setFormData({ ...formData, distanceKm: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">3€/km por encima de 15km</p>
            </div>
          </div>

          {/* Servicios */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Servicios de la Obra</h3>
              <button
                type="button"
                onClick={addItem}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Añadir Servicio</span>
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Servicio *</label>
                    <select
                      required
                      value={item.serviceId}
                      onChange={(e) => updateItem(index, 'serviceId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecciona servicio</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {s.base_price}€/{s.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dificultad *</label>
                    <select
                      required
                      value={item.difficultyFactor}
                      onChange={(e) => updateItem(index, 'difficultyFactor', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1.0">Normal (1.0x)</option>
                      <option value="1.2">Media (1.2x)</option>
                      <option value="1.5">Alta (1.5x)</option>
                      <option value="2.0">Muy difícil (2.0x)</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nota</label>
                    <input
                      type="text"
                      value={item.customNotes}
                      onChange={(e) => updateItem(index, 'customNotes', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones Generales</label>
            <textarea
              rows={3}
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Detalles adicionales de la obra..."
            />
          </div>

          {/* Total */}
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">TOTAL PRESUPUESTO:</span>
              <span className="text-2xl font-bold text-blue-700">{calculateTotal()}€</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Generando presupuesto completo...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Generar y Enviar Presupuesto Completo</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

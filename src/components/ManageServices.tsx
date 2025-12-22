import { useState, useEffect } from 'react';
import { supabase, Service } from '../lib/supabase';
import { Plus, Edit2, Trash2, CheckCircle, X } from 'lucide-react';

export default function ManageServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    base_price: '',
    unit: 'm²',
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

    if (editingId) {
      await supabase
        .from('services')
        .update({
          name: formData.name,
          base_price: parseFloat(formData.base_price),
          unit: formData.unit,
        })
        .eq('id', editingId);
    } else {
      await supabase.from('services').insert({
        name: formData.name,
        base_price: parseFloat(formData.base_price),
        unit: formData.unit,
      });
    }

    setFormData({ name: '', base_price: '', unit: 'm²' });
    setIsAdding(false);
    setEditingId(null);
    loadServices();
  };

  const handleEdit = (service: Service) => {
    setFormData({
      name: service.name,
      base_price: service.base_price,
      unit: service.unit,
    });
    setEditingId(service.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
      await supabase.from('services').delete().eq('id', id);
      loadServices();
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', base_price: '', unit: 'm²' });
    setIsAdding(false);
    setEditingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Gestionar Servicios</h2>
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Nuevo Servicio</span>
            </button>
          )}
        </div>

        {isAdding && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingId ? 'Editar Servicio' : 'Añadir Nuevo Servicio'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Pintura de pared"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio Base *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.base_price}
                  onChange={(e) =>
                    setFormData({ ...formData, base_price: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unidad *
                </label>
                <select
                  required
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="m²">m²</option>
                  <option value="m">m</option>
                  <option value="ml">ml</option>
                  <option value="unidad">unidad</option>
                  <option value="punto">punto</option>
                  <option value="hora">hora</option>
                  <option value="día">día</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <CheckCircle className="h-5 w-5" />
                <span>{editingId ? 'Guardar' : 'Añadir'}</span>
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                <X className="h-5 w-5" />
                <span>Cancelar</span>
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <p className="text-sm text-gray-600">
                  {parseFloat(service.base_price).toFixed(2)}€ por {service.unit}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(service)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Editar"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {services.length === 0 && !isAdding && (
          <div className="text-center py-12 text-gray-500">
            Ningún servicio registrado. Haz clic en "Nuevo Servicio" para añadir.
          </div>
        )}
      </div>
    </div>
  );
}

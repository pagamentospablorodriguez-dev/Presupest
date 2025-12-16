import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, User, Mail, DollarSign, MapPin, AlertCircle } from 'lucide-react';

interface Project {
  id: string;
  client_id: string;
  project_name: string;
  distance_km: string;
  total_price: string;
  observations: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  clients?: any;
}

export default function ViewBudgets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        clients (*)
      `)
      .order('created_at', { ascending: false });

    if (data) setProjects(data as Project[]);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'Pendiente',
      sent: 'Enviado',
      accepted: 'Aceptado',
      rejected: 'Rechazado',
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
        <div className="text-gray-600">Cargando presupuestos...</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white shadow-md rounded-lg p-12 text-center">
        <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Ningún presupuesto creado
        </h3>
        <p className="text-gray-600">
          Crea tu primer presupuesto usando el botón "Nuevo Presupuesto"
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Presupuestos Enviados
        </h2>
        <div className="space-y-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User className="h-5 w-5 mr-2 text-gray-500" />
                    {project.clients?.name}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-2" />
                    {project.clients?.email}
                  </p>
                </div>
                {getStatusBadge(project.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center text-sm text-gray-700">
                  <span className="font-medium mr-2">Proyecto:</span>
                  {project.project_name}
                </div>
                <div className="flex items-center text-sm text-gray-700">
                  <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="font-medium mr-2">Distancia:</span>
                  {project.distance_km} km
                </div>
              </div>

              {project.observations && (
                <div className="mb-4 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">{project.observations}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  {formatDate(project.created_at)}
                </div>
                <div className="flex items-center text-lg font-bold text-gray-900">
                  <DollarSign className="h-5 w-5 mr-1 text-green-600" />
                  {parseFloat(project.total_price).toFixed(2)}€
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

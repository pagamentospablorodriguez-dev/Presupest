import { useState, useEffect } from 'react';
import { Database } from '../lib/supabase';
import { Send, Loader2, CheckCircle } from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  total_price: string;
  clients?: any;
}

export default function RespondEmail() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSentProjects();
  }, []);

  const loadSentProjects = async () => {
    const { data } = await Bolt Database
      .from('projects')
      .select(`
        *,
        clients (*)
      `)
      .eq('status', 'sent')
      .order('created_at', { ascending: false });

    if (data) setProjects(data as Project[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    if (!selectedProject) {
      setError('Proyecto no encontrado');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/respond-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          clientEmail: selectedProject.clients?.email,
          clientName: selectedProject.clients?.name,
          projectName: selectedProject.project_name,
          totalPrice: selectedProject.total_price,
          clientMessage: clientMessage,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setClientMessage('');
        setSelectedProjectId('');
      } else {
        setError(result.error || 'Error al enviar respuesta');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Responder Email con IA
        </h2>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Sistema inteligente:</strong> Analiza la objeción del cliente y genera una respuesta personalizada, profesional y convincente automáticamente.
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">¡Respuesta generada y enviada con éxito!</span>
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
              Seleccionar Proyecto *
            </label>
            <select
              required
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Elige un proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clients?.name} - {project.project_name} - {project.total_price}€
                </option>
              ))}
            </select>
          </div>

          {selectedProject && (
            <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Detalles del Proyecto</h3>
              <div className="space-y-1 text-sm text-gray-700">
                <p><strong>Cliente:</strong> {selectedProject.clients?.name}</p>
                <p><strong>Email:</strong> {selectedProject.clients?.email}</p>
                <p><strong>Proyecto:</strong> {selectedProject.project_name}</p>
                <p><strong>Importe Total:</strong> {parseFloat(selectedProject.total_price).toFixed(2)}€</p>
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
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder='Ej: "Me parece muy caro, ¿puedes hacerlo por 500€ menos?"'
            />
          </div>

          <button
            type="submit"
            disabled={loading || !selectedProjectId}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>IA generando respuesta...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>Generar y Enviar Respuesta con IA</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

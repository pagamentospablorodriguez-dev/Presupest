import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Loader2, CheckCircle, Eye, Edit2 } from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  total_price: string;
  distance_km: string;
  clients?: any;
}

export default function RespondEmail() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSentProjects();
  }, []);

  const loadSentProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        clients (*)
      `)
      .eq('status', 'sent')
      .order('created_at', { ascending: false });

    if (data) setProjects(data as Project[]);
  };

  const generateResponse = async () => {
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    if (!selectedProject) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/generate-ai-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          clientName: selectedProject.clients?.name,
          projectName: selectedProject.project_name,
          totalPrice: selectedProject.total_price,
          distanceKm: selectedProject.distance_km,
          clientMessage: clientMessage,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAiResponse(result.response);
        setShowPreview(true);
      } else {
        setError(result.error || 'Error al generar respuesta');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const sendResponse = async () => {
    const selectedProject = projects.find((p) => p.id === selectedProjectId);
    if (!selectedProject) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/.netlify/functions/send-email-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: selectedProject.clients?.email,
          clientName: selectedProject.clients?.name,
          projectName: selectedProject.project_name,
          emailContent: aiResponse,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        setClientMessage('');
        setSelectedProjectId('');
        setAiResponse('');
        setShowPreview(false);
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
            <strong>Sistema inteligente:</strong> Analiza la objeción del cliente y genera una respuesta profesional, factual y convincente. <strong>Podrás revisar y editar antes de enviar.</strong>
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">¡Respuesta enviada con éxito!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <div className="space-y-6">
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

          {!showPreview && (
            <button
              onClick={generateResponse}
              disabled={loading || !selectedProjectId || !clientMessage.trim()}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>IA generando respuesta...</span>
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  <span>Generar Respuesta con IA</span>
                </>
              )}
            </button>
          )}

          {showPreview && (
            <div className="bg-gray-100 p-4 rounded-md border border-gray-300">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-gray-900">RESPUESTA GENERADA (Editable)</h4>
              </div>
              <textarea
                rows={15}
                value={aiResponse}
                onChange={(e) => setAiResponse(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded text-sm"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendResponse}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span>Enviar Respuesta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

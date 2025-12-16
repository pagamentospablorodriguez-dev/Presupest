import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, Loader2, CheckCircle, Eye } from 'lucide-react';

interface Project {
  id: string;
  project_name: string;
  total_price: string;
  distance_km: string;
  clients?: {
    name: string;
    email: string;
  };
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
    const { data, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        clients (*)
      `
      )
      .eq('status', 'sent')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (data) setProjects(data as Project[]);
  };

  const generateResponse = async () => {
    const selectedProject = projects.find(
      (p) => p.id === selectedProjectId
    );
    if (!selectedProject) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        '/.netlify/functions/generate-ai-response',
        {
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
        }
      );

      const result = await response.json();

      if (response.ok) {
        setAiResponse(result.response);
        setShowPreview(true);
      } else {
        setError(result.error || 'Error al generar respuesta');
      }
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const sendResponse = async () => {
    const selectedProject = projects.find(
      (p) => p.id === selectedProjectId
    );
    if (!selectedProject) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        '/.netlify/functions/send-email-response',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: selectedProject.clients?.email,
            clientName: selectedProject.clients?.name,
            projectName: selectedProject.project_name,
            emailContent: aiResponse,
          }),
        }
      );

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
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find(
    (p) => p.id === selectedProjectId
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Responder Email con IA
        </h2>

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

        <div className="space-y-6">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-4 py-2 border rounded-md"
          >
            <option value="">Elige un proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.clients?.name} – {project.project_name} –{' '}
                {project.total_price}€
              </option>
            ))}
          </select>

          <textarea
            rows={6}
            value={clientMessage}
            onChange={(e) => setClientMessage(e.target.value)}
            className="w-full p-3 border rounded-md"
            placeholder='Ej: "Me parece muy caro..."'
          />

          {!showPreview && (
            <button
              onClick={generateResponse}
              disabled={loading || !clientMessage}
              className="w-full bg-blue-600 text-white py-3 rounded-md"
            >
              {loading ? (
                <Loader2 className="animate-spin mx-auto" />
              ) : (
                <>
                  <Eye className="inline mr-2" />
                  Generar Respuesta con IA
                </>
              )}
            </button>
          )}

          {showPreview && (
            <>
              <textarea
                rows={12}
                value={aiResponse}
                onChange={(e) => setAiResponse(e.target.value)}
                className="w-full p-3 border rounded-md"
              />

              <button
                onClick={sendResponse}
                className="w-full bg-green-600 text-white py-3 rounded-md"
              >
                <Send className="inline mr-2" />
                Enviar Respuesta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Bolt Database } from '../lib/supabase';
import { Send, Loader2, CheckCircle, Plus, Trash2, Eye, Edit2, FileText } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  base_price: string;
  unit: string;
}

interface InvoiceItem {
  serviceId: string;
  quantity: string;
}

export default function CreateInvoice() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [pdfDataUrl, setPdfDataUrl] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('1');

  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    projectName: '',
    observations: '',
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { serviceId: '', quantity: '' },
  ]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    if (data) setServices(data);
  };

  const addItem = () => {
    setItems([...items, { serviceId: '', quantity: '' }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    let total = 0;
    items.forEach((item) => {
      const service = services.find((s) => s.id === item.serviceId);
      if (service && item.quantity) {
        const basePrice = parseFloat(service.base_price);
        const quantity = parseFloat(item.quantity);
        total += basePrice * quantity;
      }
    });
    return total.toFixed(2);
  };

  const generateEmailContent = () => {
    const firstName = formData.clientName.split(' ')[0];
    return `Buenas tardes ${firstName},\n\nTe envío la factura ${invoiceNumber}/025.\n\nUn saludo.`;
  };

  const generateEmailSubject = () => {
    return `Factura ${invoiceNumber}/025${formData.projectName ? ' - ' + formData.projectName : ''}`;
  };

  const handlePreview = () => {
    setEmailContent(generateEmailContent());
    setEmailSubject(generateEmailSubject());
    setShowPreview(true);
    setEditingEmail(false);
  };

  const handlePdfPreview = async () => {
    try {
      const response = await fetch('/.netlify/functions/generate-invoice-pdf-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          invoiceNumber: parseInt(invoiceNumber),
          items: items.map((item) => ({
            serviceId: item.serviceId,
            quantity: parseFloat(item.quantity),
          })),
        }),
      });

      const result = await response.json();
      if (response.ok && result.pdfDataUrl) {
        setPdfDataUrl(result.pdfDataUrl);
        setShowPdfPreview(true);
      }
    } catch (err) {
      console.error('Error generating PDF preview');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const finalEmailContent = showPreview && emailContent ? emailContent : generateEmailContent();
      const finalEmailSubject = showPreview && emailSubject ? emailSubject : generateEmailSubject();

      const response = await fetch('/.netlify/functions/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          invoiceNumber: parseInt(invoiceNumber),
          emailContent: finalEmailContent,
          emailSubject: finalEmailSubject,
          items: items.map((item) => ({
            serviceId: item.serviceId,
            quantity: parseFloat(item.quantity),
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
          projectName: '',
          observations: '',
        });
        setItems([{ serviceId: '', quantity: '' }]);
        setShowPreview(false);
        setShowPdfPreview(false);
        setEditingEmail(false);
        setInvoiceNumber((parseInt(invoiceNumber) + 1).toString());
      } else {
        setError(result.error || 'Error al generar factura');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const getServiceUnit = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    return service?.unit || '';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-green-600 to-green-800 text-white p-8 rounded-t-lg shadow-lg">
        <h2 className="text-3xl font-bold mb-3">Nueva Factura</h2>
        <p className="text-lg text-green-50 leading-relaxed">
          Genera facturas profesionales en PDF y envía por email automáticamente.
        </p>
      </div>

      <div className="bg-white shadow-md rounded-b-lg p-6">
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800">¡Factura enviada con éxito!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Cliente *</label>
              <input
                type="text"
                required
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                required
                value={formData.clientEmail}
                onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
              <input
                type="tel"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nº Factura *</label>
              <input
                type="number"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción / Proyecto</label>
            <input
              type="text"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Productos / Servicios</h3>
              <button
                type="button"
                onClick={addItem}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Añadir Item</span>
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Producto / Servicio *</label>
                    <select
                      required
                      value={item.serviceId}
                      onChange={(e) => updateItem(index, 'serviceId', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Selecciona producto/servicio</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {s.base_price}€/{s.unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cantidad {getServiceUnit(item.serviceId) && `(${getServiceUnit(item.serviceId)})`} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observaciones</label>
            <textarea
              rows={3}
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-green-50 p-4 rounded-md border border-green-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">TOTAL FACTURA:</span>
              <span className="text-2xl font-bold text-green-700">{calculateTotal()}€</span>
            </div>
          </div>

          {showPreview && (
            <div className="bg-gray-100 p-4 rounded-md border border-gray-300">
              <h4 className="font-bold text-gray-900 mb-3">VISTA PREVIA DEL EMAIL</h4>
              
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                />
              </div>

              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Contenido</label>
                <button
                  type="button"
                  onClick={() => setEditingEmail(!editingEmail)}
                  className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>{editingEmail ? 'Ver' : 'Editar'}</span>
                </button>
              </div>
              {editingEmail ? (
                <textarea
                  rows={6}
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded text-sm"
                />
              ) : (
                <div className="bg-white p-4 rounded text-sm text-gray-700 whitespace-pre-wrap">
                  {emailContent}
                </div>
              )}
            </div>
          )}

          {showPdfPreview && pdfDataUrl && (
            <div className="bg-gray-100 p-4 rounded-md border border-gray-300">
              <h4 className="font-bold text-gray-900 mb-3">VISTA PREVIA DEL PDF</h4>
              <iframe
                src={pdfDataUrl}
                className="w-full h-96 border border-gray-300 rounded"
                title="PDF Preview"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePreview}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 flex items-center justify-center space-x-2"
            >
              <Eye className="h-5 w-5" />
              <span>{showPreview ? 'Actualizar' : 'Ver'} Email</span>
            </button>
            <button
              type="button"
              onClick={handlePdfPreview}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 flex items-center justify-center space-x-2"
            >
              <FileText className="h-5 w-5" />
              <span>Ver PDF</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Enviar Factura</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


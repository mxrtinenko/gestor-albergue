import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Calendar, Coins, ShieldCheck, Percent, Clock } from "lucide-react"; 
import { toast } from "sonner";
import { apiService } from "../services/api";

const Reports = () => {
  // Inicializamos por defecto con el mes actual
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  
  const [taxRate, setTaxRate] = useState(10);
  const [loadingPoliceCSV, setLoadingPoliceCSV] = useState(false);
  const [loadingPoliceXML, setLoadingPoliceXML] = useState(false);
  const [loadingFinance, setLoadingFinance] = useState(false);

  // --- FUNCIONES DE BOTONES RÁPIDOS ---
  const setDateRange = (start: Date, end: Date) => {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
  };

  const selectToday = () => {
      const t = new Date();
      setDateRange(t, t);
  };

  const selectYesterday = () => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      setDateRange(y, y);
  };

  const selectThisMonth = () => {
      const t = new Date();
      setDateRange(new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0));
  };

  const selectLastMonth = () => {
      const t = new Date();
      setDateRange(new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0));
  };

  // --- DESCARGAS ---
  
  // Descarga Parte Guardia Civil (CSV interno)
  const handleDownloadPoliceCSV = async () => {
    setLoadingPoliceCSV(true);
    try {
      await apiService.downloadReport(startDate, endDate);
      toast.success("CSV de Viajeros descargado");
    } catch (error) {
      toast.error("Error al generar el CSV policial");
    } finally {
      setLoadingPoliceCSV(false);
    }
  };

  // Descarga Parte Guardia Civil (XML Oficial para SES)
  const handleDownloadPoliceXML = async () => {
    setLoadingPoliceXML(true);
    try {
      await apiService.downloadPoliceReportXML(startDate, endDate);
      toast.success("XML oficial descargado con éxito");
    } catch (error) {
      toast.error("Error al generar el XML policial");
    } finally {
      setLoadingPoliceXML(false);
    }
  };

  // Descarga Informe Económico
  const handleDownloadFinance = async () => {
    setLoadingFinance(true);
    try {
      await apiService.downloadAccountingReport(startDate, endDate, taxRate);
      toast.success("Informe de Facturación descargado");
    } catch (error) {
      toast.error("Error al generar informe económico");
    } finally {
      setLoadingFinance(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl animate-fade-in p-6">
      <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
        Centro de Informes
      </h1>
      <p className="text-muted-foreground mb-8">
        Genera la documentación legal y fiscal de tu alojamiento según el periodo seleccionado.
      </p>

      {/* Panel Superior: Filtros de Fecha */}
      <div className="bg-white p-5 rounded-xl border shadow-sm mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b pb-4">
            <Clock className="w-4 h-4 text-muted-foreground mr-1" />
            <span className="text-sm font-semibold text-muted-foreground mr-2">Filtros rápidos:</span>
            <Button variant="outline" size="sm" onClick={selectToday}>Hoy</Button>
            <Button variant="outline" size="sm" onClick={selectYesterday}>Ayer</Button>
            <Button variant="outline" size="sm" onClick={selectThisMonth}>Este mes</Button>
            <Button variant="outline" size="sm" onClick={selectLastMonth}>Mes pasado</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-end pt-2">
          <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Fecha Inicio</label>
              <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-10 w-full sm:w-48 bg-secondary/10"
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                  />
              </div>
          </div>
          <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Fecha Fin</label>
              <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-10 w-full sm:w-48 bg-secondary/10"
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                  />
              </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        
        {/* 1. GUARDIA CIVIL */}
        <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-blue-600 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShieldCheck className="text-blue-600 h-6 w-6" />
              </div>
              Parte de Viajeros
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Archivo oficial para Hospederías (Policía/Guardia Civil). <br/>
              <strong>Nota legal:</strong> Debe enviarse en las 24h posteriores al check-in. Usa el filtro "Hoy" o "Ayer".
            </p>
          </CardHeader>
          <CardContent className="mt-auto space-y-3">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm h-12 text-md" 
              onClick={handleDownloadPoliceXML}
              disabled={loadingPoliceXML}
            >
              {loadingPoliceXML ? "Generando XML..." : (
                <>
                  <ShieldCheck className="mr-2 h-5 w-5" /> Descargar XML (Oficial SES)
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              className="w-full border-blue-200 text-blue-700 hover:bg-blue-50" 
              onClick={handleDownloadPoliceCSV}
              disabled={loadingPoliceCSV}
            >
              {loadingPoliceCSV ? "Generando CSV..." : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Descargar CSV (Uso Interno)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2. FACTURACIÓN / CONTABILIDAD */}
        <Card className="shadow-md hover:shadow-lg transition-all border-l-4 border-l-emerald-600 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Coins className="text-emerald-600 h-6 w-6" />
              </div>
              Informe Económico
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Resumen de ingresos para el gestor/contable. Desglosa las bases imponibles, los impuestos y los métodos de pago.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 mt-auto">
            
            <div className="flex items-center justify-between bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <Label className="text-sm font-semibold text-emerald-900">Impuesto aplicado (IVA/IGIC)</Label>
                <div className="relative w-24">
                    <Input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="pr-8 text-right bg-white border-emerald-200 focus-visible:ring-emerald-500"
                    />
                    <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
            </div>

            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-md"
              onClick={handleDownloadFinance}
              disabled={loadingFinance}
            >
              {loadingFinance ? "Calculando..." : (
                <>
                  <FileText className="mr-2 h-5 w-5" /> Descargar Excel Ventas
                </>
              )}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Reports;
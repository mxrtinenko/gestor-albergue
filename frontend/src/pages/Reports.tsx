import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Calendar, Coins, ShieldCheck, Percent, Clock, Landmark } from "lucide-react"; 
import { toast } from "sonner";
import { apiService } from "../services/api";

const Reports = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  
  const [taxRate, setTaxRate] = useState(10);
  const [loadingPoliceCSV, setLoadingPoliceCSV] = useState(false);
  const [loadingPoliceXML, setLoadingPoliceXML] = useState(false);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [loadingAEAT, setLoadingAEAT] = useState(false);

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

  const handleDownloadAEAT = async () => {
    setLoadingAEAT(true);
    try {
      await apiService.downloadAEATReport(startDate, endDate);
      toast.success("Registro Antifraude AEAT descargado");
    } catch (error) {
      toast.error("Error al generar el registro para Hacienda");
    } finally {
      setLoadingAEAT(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl animate-fade-in p-6 text-foreground">
      <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
        Centro de Informes
      </h1>
      <p className="text-muted-foreground mb-8">
        Genera la documentación legal y fiscal de tu alojamiento según el periodo seleccionado.
      </p>

      {/* Panel Superior: Filtros de Fecha */}
      <div className="bg-card p-5 rounded-xl border border-border shadow-sm mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
            <Clock className="w-4 h-4 text-muted-foreground mr-1" />
            <span className="text-sm font-semibold text-muted-foreground mr-2">Filtros rápidos:</span>
            <Button variant="outline" size="sm" className="bg-transparent border-border hover:bg-muted" onClick={selectToday}>Hoy</Button>
            <Button variant="outline" size="sm" className="bg-transparent border-border hover:bg-muted" onClick={selectYesterday}>Ayer</Button>
            <Button variant="outline" size="sm" className="bg-transparent border-border hover:bg-muted" onClick={selectThisMonth}>Este mes</Button>
            <Button variant="outline" size="sm" className="bg-transparent border-border hover:bg-muted" onClick={selectLastMonth}>Mes pasado</Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-end pt-2">
          <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">Fecha Inicio</label>
              <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-10 w-full sm:w-48 bg-muted/50 border-border text-foreground"
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
                    className="pl-10 w-full sm:w-48 bg-muted/50 border-border text-foreground"
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                  />
              </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        {/* 1. GUARDIA CIVIL */}
        <Card className="bg-card shadow-md hover:shadow-lg transition-all border-l-4 border-l-blue-600 border-y-border border-r-border flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <ShieldCheck className="text-blue-600 dark:text-blue-400 h-6 w-6" />
              </div>
              Parte de Viajeros
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Archivo oficial para Hospederías (Policía/Guardia Civil). <br/>
              <strong className="text-foreground">Nota legal:</strong> Debe enviarse en las 24h posteriores al check-in.
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
                  <ShieldCheck className="mr-2 h-5 w-5" /> Descargar XML (Oficial)
                </>
              )}
            </Button>
            
            <Button 
              variant="outline"
              className="w-full bg-transparent border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" 
              onClick={handleDownloadPoliceCSV}
              disabled={loadingPoliceCSV}
            >
              {loadingPoliceCSV ? "Generando CSV..." : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Descargar CSV (Interno)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 2. FACTURACIÓN / CONTABILIDAD */}
        <Card className="bg-card shadow-md hover:shadow-lg transition-all border-l-4 border-l-emerald-600 border-y-border border-r-border flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Coins className="text-emerald-600 dark:text-emerald-400 h-6 w-6" />
              </div>
              Informe Económico
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Resumen para tu gestor o uso interno. Desglosa bases imponibles, impuestos y métodos de pago.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 mt-auto">
            
            <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900">
                <Label className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Impuesto (IVA/IGIC)</Label>
                <div className="relative w-24">
                    <Input 
                        type="number" 
                        min="0" 
                        max="100"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Number(e.target.value))}
                        className="pr-8 text-right bg-background border-emerald-200 dark:border-emerald-800 focus-visible:ring-emerald-500 text-foreground"
                    />
                    <Percent className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
            </div>

            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-md"
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

        {/* 3. HACIENDA (VERIFACTU) */}
        <Card className="bg-card shadow-md hover:shadow-lg transition-all border-l-4 border-l-red-600 border-y-border border-r-border flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-foreground">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <Landmark className="text-red-600 dark:text-red-400 h-6 w-6" />
              </div>
              Auditoría AEAT
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Registro inalterable de facturación adaptado a la <strong className="text-foreground">Ley Antifraude (VeriFactu)</strong>. Contiene la cadena de Hashes.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 mt-auto">
            <div className="bg-red-50/50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900 text-xs text-red-900 dark:text-red-200">
              Usa este botón <strong className="text-red-700 dark:text-red-400">únicamente</strong> si un inspector de Hacienda te requiere el registro de facturación de un periodo específico.
            </div>
            <Button 
              className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-md"
              onClick={handleDownloadAEAT}
              disabled={loadingAEAT}
            >
              {loadingAEAT ? "Extrayendo hashes..." : (
                <>
                  <Landmark className="mr-2 h-5 w-5" /> Descargar Registro Oficial
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
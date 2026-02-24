import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // <-- ¡AQUÍ ESTÁ EL IMPORT QUE FALTABA!
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Calendar, Coins, ShieldCheck, Percent } from "lucide-react"; 
import { toast } from "sonner";
import { apiService } from "../services/api";

const Reports = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  
  // NUEVO: Estado para el IVA (Por defecto 10%)
  const [taxRate, setTaxRate] = useState(10);
  
  const [loadingPolice, setLoadingPolice] = useState(false);
  const [loadingFinance, setLoadingFinance] = useState(false);

  // Descarga Parte Guardia Civil
  const handleDownloadPolice = async () => {
    setLoadingPolice(true);
    try {
      await apiService.downloadReport(startDate, endDate);
      toast.success("Parte de Viajeros descargado");
    } catch (error) {
      toast.error("Error al generar el parte policial");
    } finally {
      setLoadingPolice(false);
    }
  };

  // Descarga Informe Económico
  const handleDownloadFinance = async () => {
    setLoadingFinance(true);
    try {
      // Pasamos el nuevo parámetro de impuestos a la API
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
        Genera la documentación legal y fiscal de tu alojamiento.
      </p>

      {/* Selector de Fechas Global */}
      <div className="bg-white p-4 rounded-xl border shadow-sm mb-8 flex flex-col sm:flex-row gap-4 items-end">
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
              Archivo oficial para la web de Hospederías (Guardia Civil / Policía Nacional). Contiene datos personales de los huéspedes.
            </p>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-md" 
              onClick={handleDownloadPolice}
              disabled={loadingPolice}
            >
              {loadingPolice ? "Generando..." : (
                <>
                  <Download className="mr-2 h-5 w-5" /> Descargar CSV Policial
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
              Resumen de ingresos para el gestor/contable. Incluye desglose de bases, IVA, métodos de pago y totales por reserva.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 mt-auto">
            
            {/* NUEVO: Campo de entrada de IVA */}
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
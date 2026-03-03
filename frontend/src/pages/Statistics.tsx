import React, { useState, useEffect } from "react";
import { apiService } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Euro, Map, BedDouble, Loader2, BarChart3, ArrowRightLeft } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';

// Paleta de colores 
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1'];

const Statistics = () => {
  // Estados para Pestaña 1 (Resumen)
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Estados para Pestaña 2 (Comparativa)
  const [compY1, setCompY1] = useState(new Date().getFullYear().toString());
  const [compM1, setCompM1] = useState((new Date().getMonth() + 1).toString());
  const [compY2, setCompY2] = useState((new Date().getFullYear() - 1).toString());
  const [compM2, setCompM2] = useState((new Date().getMonth() + 1).toString());
  const [compData, setCompData] = useState<any>(null);
  const [loadingComp, setLoadingComp] = useState(false);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const m = month === "all" ? undefined : parseInt(month);
      const res = await apiService.getStats(parseInt(year), m);
      setData(res);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const fetchComparison = async () => {
    setLoadingComp(true);
    try {
      const m1 = compM1 === "all" ? undefined : parseInt(compM1);
      const m2 = compM2 === "all" ? undefined : parseInt(compM2);
      const res = await apiService.getComparison(parseInt(compY1), parseInt(compY2), m1, m2);
      setCompData(res);
    } catch (e) { console.error(e); } 
    finally { setLoadingComp(false); }
  };

  useEffect(() => { fetchSummary(); }, [year, month]);
  useEffect(() => { fetchComparison(); }, [compY1, compM1, compY2, compM2]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const formatPeriodName = (y: string, m: string) => {
    return m === "all" ? `Año ${y}` : `${monthNames[parseInt(m)-1]} ${y}`;
  };

  const comparativeChartData = compData ? [
    {
      name: 'Peregrinos',
      [formatPeriodName(compY1, compM1)]: compData.periodo1.peregrinos,
      [formatPeriodName(compY2, compM2)]: compData.periodo2.peregrinos,
    },
    {
      name: 'Ingresos (€)',
      [formatPeriodName(compY1, compM1)]: compData.periodo1.ingresos,
      [formatPeriodName(compY2, compM2)]: compData.periodo2.ingresos,
    }
  ] : [];

  return (
    <div className="mx-auto max-w-6xl p-6 animate-fade-in pb-20">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-foreground">Estadísticas</h1>
        <p className="text-muted-foreground text-sm">Analiza el rendimiento y evolución de tu albergue</p>
      </div>

      <Tabs defaultValue="resumen" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="resumen" className="gap-2"><BarChart3 className="h-4 w-4"/> Resumen Actual</TabsTrigger>
          <TabsTrigger value="comparativa" className="gap-2"><ArrowRightLeft className="h-4 w-4"/> Comparativa</TabsTrigger>
        </TabsList>

        {/* ================= PESTAÑA 1: RESUMEN ================= */}
        <TabsContent value="resumen" className="space-y-6">
          <div className="flex gap-2 bg-white p-2 rounded-lg border shadow-sm w-fit">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28 border-0 shadow-none focus:ring-0"><SelectValue placeholder="Año"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
            <div className="w-px bg-border my-2"></div>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-40 border-0 shadow-none focus:ring-0"><SelectValue placeholder="Mes"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el año</SelectItem>
                {monthNames.map((m, i) => (<SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {loading || !data ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
          ) : (
            <>
              {/* Tarjetas KPI */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div><p className="text-sm font-medium text-muted-foreground">Peregrinos</p><h3 className="text-3xl font-bold">{data.peregrinos}</h3></div>
                            <div className="p-2 bg-primary/10 rounded-full"><Users className="h-5 w-5 text-primary"/></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div><p className="text-sm font-medium text-muted-foreground">Ingresos Brutos</p><h3 className="text-3xl font-bold">{data.ingresos}€</h3></div>
                            <div className="p-2 bg-emerald-100 rounded-full"><Euro className="h-5 w-5 text-emerald-600"/></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div><p className="text-sm font-medium text-muted-foreground">Ocupación</p><h3 className="text-3xl font-bold">{data.ocupacion}%</h3></div>
                            <div className="p-2 bg-blue-100 rounded-full"><BedDouble className="h-5 w-5 text-blue-600"/></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                            <div><p className="text-sm font-medium text-muted-foreground">Países Origen</p><h3 className="text-3xl font-bold">{data.paises}</h3></div>
                            <div className="p-2 bg-amber-100 rounded-full"><Map className="h-5 w-5 text-amber-600"/></div>
                        </div>
                    </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* --- GRÁFICO NACIONALIDADES (SIN BANDERAS) --- */}
                <Card className="shadow-sm">
                    <CardHeader><CardTitle className="text-lg">Top Nacionalidades</CardTitle></CardHeader>
                    <CardContent className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={data.nacionalidades} 
                                layout="vertical" 
                                margin={{ left: 10, right: 30, top: 10, bottom: 10 }}
                            >
                                <defs>
                                    <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                                        <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={120} 
                                    tick={{fontSize: 12, fill: '#475569', fontWeight: 500}}
                                    axisLine={false} 
                                    tickLine={false} 
                                />
                                <Tooltip 
                                    cursor={{fill: '#f3f4f6', radius: 4}} 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [<span className="font-bold text-primary">{value} pax</span>, 'Total']} 
                                />
                                <Bar 
                                    dataKey="value" 
                                    fill="url(#colorBar)" 
                                    radius={[0, 4, 4, 0]} 
                                    barSize={24}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <div className="grid gap-6">
                  <Card className="shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-center">Métodos de Pago</CardTitle></CardHeader>
                      <CardContent className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie 
                                    data={data.metodos_pago} 
                                    innerRadius={55} 
                                    outerRadius={75} 
                                    paddingAngle={3} 
                                    dataKey="value"
                                    stroke="none"
                                  >
                                      {data.metodos_pago.map((_:any, index:number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <Tooltip formatter={(value) => [`${value} reservas`, '']} />
                                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                              </PieChart>
                          </ResponsiveContainer>
                      </CardContent>
                  </Card>
                  
                  <Card className="shadow-sm">
                      <CardHeader><CardTitle className="text-lg text-center">Desglose por Género</CardTitle></CardHeader>
                      <CardContent className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie 
                                    data={data.generos} 
                                    innerRadius={55} 
                                    outerRadius={75} 
                                    paddingAngle={3} 
                                    dataKey="value"
                                    stroke="none"
                                  >
                                      <Cell fill="#3b82f6" /> {/* Hombres - Azul */}
                                      <Cell fill="#ec4899" /> {/* Mujeres - Rosa */}
                                      <Cell fill="#94a3b8" /> {/* Otros - Gris */}
                                  </Pie>
                                  <Tooltip formatter={(value) => [`${value} pax`, '']} />
                                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                              </PieChart>
                          </ResponsiveContainer>
                      </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ================= PESTAÑA 2: COMPARATIVA ================= */}
        <TabsContent value="comparativa" className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="bg-secondary/20 pb-4">
              <CardTitle className="text-lg">Configurar Comparativa</CardTitle>
              <CardDescription>Selecciona dos periodos en el tiempo para enfrentar sus resultados.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x">
              <div className="space-y-3">
                <Badge className="bg-primary hover:bg-primary mb-2">Periodo A (Principal)</Badge>
                <div className="flex gap-2">
                  <Select value={compY1} onValueChange={setCompY1}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
                  <Select value={compM1} onValueChange={setCompM1}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todo el año</SelectItem>{monthNames.map((m, i) => (<SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>))}</SelectContent></Select>
                </div>
              </div>
              <div className="space-y-3 md:pl-8 pt-6 md:pt-0">
                <Badge variant="secondary" className="mb-2">Periodo B (A comparar)</Badge>
                <div className="flex gap-2">
                  <Select value={compY2} onValueChange={setCompY2}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent></Select>
                  <Select value={compM2} onValueChange={setCompM2}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todo el año</SelectItem>{monthNames.map((m, i) => (<SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>))}</SelectContent></Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingComp || !compData ? (
             <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 shadow-sm">
                <CardHeader><CardTitle className="text-lg">Tabla de Variación</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1 uppercase tracking-wider">Peregrinos</p>
                      <div className="flex justify-between items-end border-b pb-2">
                        <div><p className="text-2xl font-bold text-primary">{compData.periodo1.peregrinos}</p><p className="text-xs text-muted-foreground">Per. A</p></div>
                        <div className="text-right"><p className="text-lg font-medium">{compData.periodo2.peregrinos}</p><p className="text-xs text-muted-foreground">Per. B</p></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1 uppercase tracking-wider">Ingresos Brutos</p>
                      <div className="flex justify-between items-end border-b pb-2">
                        <div><p className="text-2xl font-bold text-emerald-600">{compData.periodo1.ingresos}€</p><p className="text-xs text-muted-foreground">Per. A</p></div>
                        <div className="text-right"><p className="text-lg font-medium">{compData.periodo2.ingresos}€</p><p className="text-xs text-muted-foreground">Per. B</p></div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-muted-foreground mb-1 uppercase tracking-wider">Ocupación</p>
                      <div className="flex justify-between items-end border-b pb-2">
                        <div><p className="text-2xl font-bold text-blue-600">{compData.periodo1.ocupacion}%</p><p className="text-xs text-muted-foreground">Per. A</p></div>
                        <div className="text-right"><p className="text-lg font-medium">{compData.periodo2.ocupacion}%</p><p className="text-xs text-muted-foreground">Per. B</p></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 shadow-sm">
                <CardHeader><CardTitle className="text-lg">Gráfico Comparativo</CardTitle></CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparativeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey={formatPeriodName(compY1, compM1)} fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={formatPeriodName(compY2, compM2)} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Statistics;
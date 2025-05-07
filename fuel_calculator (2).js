// Fuel Calculator para SimHub - iRacing
// Gerado automaticamente em 07/05/2025
// Versão 1.0

function fuelCalculator(data) {
  // Obter dados do simulador iRacing com os caminhos corretos de propriedades
  var fuelLevel = data.GameRawData.Telemetry.FuelLevel;
  var fuelPerLap = calculateFuelUsage(data); // Função auxiliar para cálculo dinâmico
  var lapsRemaining = data.GameRawData.Telemetry.SessionLapsRemain;
  var currentLap = data.GameRawData.Telemetry.Lap;
  var maxFuel = data.GameRawData.Telemetry.MaxFuel;
  var isInPit = data.GameRawData.Telemetry.OnPitRoad;
  
  // Configurações personalizáveis
  var margin = 2;
  var lowFuelThreshold = 1.1;
  var criticalFuelThreshold = 0.8;
  
  // Armazenar histórico de combustível para médias (mantém apenas as últimas 10 medições)
  if (!this.fuelHistory) {
    this.fuelHistory = [];
    this.lastLapFuel = fuelLevel;
    this.lastLapNumber = currentLap;
    this.fuelPerLapHistory = [];
  }
  
  // Salva o nível de combustível no histórico a cada segundo
  if (!this.lastSaveTime || new Date() - this.lastSaveTime > 1000) {
    this.fuelHistory.push(fuelLevel);
    if (this.fuelHistory.length > 20) this.fuelHistory.shift();
    this.lastSaveTime = new Date();
  }
  
  // Verificar se completou uma volta para calcular consumo
  if (currentLap > this.lastLapNumber) {
    var lapFuelUsed = Math.max(0, this.lastLapFuel - fuelLevel);
    
    // Adiciona ao histórico apenas se for um valor válido
    if (lapFuelUsed > 0 && lapFuelUsed < 10) { // Evita valores absurdos
      this.fuelPerLapHistory.push(lapFuelUsed);
      if (this.fuelPerLapHistory.length > 5) this.fuelPerLapHistory.shift();
    }
    
    this.lastLapFuel = fuelLevel;
    this.lastLapNumber = currentLap;
  }
  
  // Calcula consumo médio com base no histórico
  function calculateAverageFuel(history) {
    if (!history || history.length === 0) return fuelPerLap;
    var sum = 0;
    for (var i = 0; i < history.length; i++) {
      sum += history[i];
    }
    return sum / history.length;
  }
  
  // Usa consumo médio do histórico se disponível, caso contrário usa estimativa do iRacing
  var avgFuelPerLap = this.fuelPerLapHistory.length > 0 
    ? calculateAverageFuel(this.fuelPerLapHistory) 
    : fuelPerLap;
  
  // Cálculos para reabastecimento e janela de pit
  var fuelNeeded = lapsRemaining * avgFuelPerLap;
  var fuelNeededWithMargin = fuelNeeded + margin;
  var refuelAmount = Math.max(0, fuelNeededWithMargin - fuelLevel);
  
  // Calcular volta ideal para pit
  function calculateOptimalPitLap(currentLap, totalLaps, fuelPerLap, currentFuel) {
    // Se o combustível atual é suficiente para terminar a corrida com margem
    if (currentFuel >= fuelNeededWithMargin) {
      return totalLaps; // Não precisa parar
    }
    
    // Quantas voltas conseguimos fazer com o combustível atual
    var lapsWithCurrentFuel = Math.floor(currentFuel / avgFuelPerLap);
    
    // Volta ideal para pit: volta atual + máximo de voltas possíveis com combustível atual
    // Subtraímos 1 para garantir margem de segurança
    var optimalLap = Math.max(currentLap + lapsWithCurrentFuel - 1, currentLap + 1);
    
    // Garantir que não ultrapasse o total de voltas
    return Math.min(optimalLap, totalLaps);
  }
  
  var totalLaps = currentLap + lapsRemaining;
  var optimalPitLap = calculateOptimalPitLap(currentLap, totalLaps, avgFuelPerLap, fuelLevel);
  
  // Status do combustível
  var fuelStatus = fuelLevel / avgFuelPerLap < criticalFuelThreshold ? "critical" : 
                  fuelLevel / avgFuelPerLap < lowFuelThreshold ? "low" : "ok";
  
  // Verificar se está na janela ideal para pit
  var pitWindowRange = 1;
  var isInPitWindow = Math.abs(currentLap - optimalPitLap) <= pitWindowRange;

  // Retornar dados para o overlay
  return {
    fuel_level: fuelLevel,
    fuel_per_lap: avgFuelPerLap,
    last_lap_fuel: this.fuelPerLapHistory.length > 0 ? this.fuelPerLapHistory[this.fuelPerLapHistory.length - 1] : 0,
    refuel_amount: refuelAmount.toFixed(2),
    status: fuelStatus,
    laps_remaining: lapsRemaining,
    current_lap: currentLap,
    max_fuel: maxFuel || 100,
    optimal_pit_lap: optimalPitLap,
    is_in_pit_window: isInPitWindow,
    is_in_pit: isInPit,
    fuel_history: this.fuelHistory,
    margin: margin
  };
}

// Função auxiliar para calcular consumo de combustível
function calculateFuelUsage(data) {
  // Tenta obter valor diretamente do iRacing, ou calcula se não disponível
  var directValue = data.GameRawData.Telemetry.FuelPerLap;
  
  if (directValue && directValue > 0) {
    return directValue;
  }
  
  // Caso o iRacing não forneça o valor diretamente, estima com base nos dados de sessão
  var sessionFuelAvg = data.GameRawData.Telemetry.SessionFuelAvg;
  if (sessionFuelAvg && sessionFuelAvg > 0) {
    return sessionFuelAvg;
  }
  
  // Valor padrão seguro se nenhuma outra opção estiver disponível
  return 2.5; // Litros por volta padrão
}

function Update(data) {
  // Certifique-se de que o simulador é o iRacing
  if (data.GameName !== "iRacing") {
    return {};
  }
  
  // Certifique-se de que os dados necessários estão presentes
  if (!data.GameRawData || !data.GameRawData.Telemetry) {
    return {
      fuel_level: 0,
      fuel_per_lap: 0,
      refuel_amount: 0,
      status: "unknown",
      laps_remaining: 0,
      current_lap: 0,
      error: "Telemetria não disponível"
    };
  }
  
  try {
    // Chama a função principal para calcular os dados de combustível
    return fuelCalculator(data);
  } catch (e) {
    // Log de erros para facilitar depuração no SimHub
    SimHub.Logging.Error("Erro no calculador de combustível: " + e.toString());
    
    return {
      fuel_level: 0,
      fuel_per_lap: 0,
      refuel_amount: 0,
      status: "error",
      laps_remaining: 0,
      current_lap: 0,
      error: e.toString()
    };
  }
}
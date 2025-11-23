"""
Test endpoint for anomaly alerts
POST /api/test/anomaly - Trigger a test anomaly alert
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime
import logging

from app.api.market_websocket import manager as ws_manager
from app.services.anomaly_monitor import get_anomaly_monitor

logger = logging.getLogger(__name__)

router = APIRouter()


class TestAnomalyRequest(BaseModel):
    """Request to trigger a test anomaly alert"""
    message: str = "Test anomaly detected"
    severity: str = "high"  # low, medium, high
    anomaly_type: str = "test"
    metric: str = "test_metric"


@router.post("/test/anomaly")
async def trigger_test_anomaly(request: TestAnomalyRequest):
    """
    Trigger a test anomaly alert that will be broadcast to all connected frontend clients.
    
    This endpoint allows testing anomaly alerts without running the full worker.
    The alert will be sent via WebSocket to all connected crypto clients.
    """
    try:
        # Create a simulated anomaly
        simulated_anomaly = {
            "metric": request.metric,
            "current_value": 100500.0,
            "message": request.message,
            "anomaly_type": request.anomaly_type,
            "severity": request.severity,
            "context": "Test anomaly alert from API endpoint",
            "source": "test",
            "symbol": "BTC"
        }
        
        # Create alert message
        alert_message = f"TEST ANOMALY: {request.message}"
        anomaly_summaries = [
            f"- {request.metric}: {request.message} (severity: {request.severity})"
        ]
        full_message = f"ANOMALY DETECTED:\n" + "\n".join(anomaly_summaries)
        
        # Broadcast to all connected crypto WebSocket clients
        alert_payload = {
            "type": "ANOMALY_ALERT",
            "message": full_message,
            "anomalies": [simulated_anomaly],
            "count": 1,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get active connections count
        active_connections = len(ws_manager.active_connections.get("crypto", set()))
        
        if active_connections > 0:
            # Broadcast to all crypto connections (BTC subscribers)
            await ws_manager.broadcast_to_subscribers("crypto", "BTC", alert_payload)
            logger.info(f"✅ Test anomaly alert broadcasted to {active_connections} connection(s)")
            
            return {
                "success": True,
                "message": "Test anomaly alert broadcasted",
                "connections": active_connections,
                "alert": alert_payload
            }
        else:
            logger.warning("⚠️  No active WebSocket connections - alert not broadcasted")
            return {
                "success": False,
                "message": "No active WebSocket connections",
                "connections": 0,
                "alert": alert_payload
            }
            
    except Exception as e:
        logger.error(f"Failed to trigger test anomaly: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to trigger test anomaly: {str(e)}")


@router.post("/test/anomaly/simulated")
async def trigger_simulated_anomaly():
    """
    Trigger a realistic simulated anomaly alert (BTC price spike).
    
    This creates a more realistic test scenario with actual anomaly detection logic.
    """
    try:
        # Use the anomaly monitor to create a realistic test
        monitor = get_anomaly_monitor()
        
        # Build baseline
        baseline_prices = [96500.00, 96550.00, 96520.00, 96530.00, 96540.00]
        for price in baseline_prices:
            monitor.add_metric_value("btc_price", price)
        
        # Detect an anomaly (price spike)
        anomaly = monitor.detect_anomalies("btc_price", 100500.0)  # ~4% spike
        
        if not anomaly:
            # Fallback if no anomaly detected
            anomaly = {
                "metric": "btc_price",
                "current_value": 100500.0,
                "previous_value": 96540.0,
                "rate_of_change": 0.0414,
                "change_percent": 4.14,
                "anomaly_type": "sudden_change",
                "severity": "high",
                "message": "btc_price changed 4.14% suddenly (96540.00 → 100500.00)",
            }
        
        # Format anomaly with context
        anomaly_with_context = {
            **anomaly,
            "context": f"Finnhub BTC price anomaly: ${anomaly.get('current_value', 100500):,.2f}",
            "source": "finnhub",
            "symbol": "BTC"
        }
        
        # Create alert message
        anomaly_summaries = [
            f"- {anomaly_with_context['metric']}: {anomaly_with_context.get('message', 'Anomaly detected')} (severity: {anomaly_with_context['severity']})"
        ]
        full_message = f"ANOMALY DETECTED:\n" + "\n".join(anomaly_summaries)
        
        # Broadcast to all connected crypto WebSocket clients
        alert_payload = {
            "type": "ANOMALY_ALERT",
            "message": full_message,
            "anomalies": [anomaly_with_context],
            "count": 1,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Get active connections count
        active_connections = len(ws_manager.active_connections.get("crypto", set()))
        
        if active_connections > 0:
            # Broadcast to all crypto connections
            await ws_manager.broadcast_to_subscribers("crypto", "BTC", alert_payload)
            logger.info(f"✅ Simulated anomaly alert broadcasted to {active_connections} connection(s)")
            
            return {
                "success": True,
                "message": "Simulated anomaly alert broadcasted",
                "connections": active_connections,
                "anomaly": anomaly_with_context,
                "alert": alert_payload
            }
        else:
            logger.warning("⚠️  No active WebSocket connections - alert not broadcasted")
            return {
                "success": False,
                "message": "No active WebSocket connections",
                "connections": 0,
                "anomaly": anomaly_with_context,
                "alert": alert_payload
            }
            
    except Exception as e:
        logger.error(f"Failed to trigger simulated anomaly: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to trigger simulated anomaly: {str(e)}")


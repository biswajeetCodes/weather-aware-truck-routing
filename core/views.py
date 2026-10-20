import requests
from rest_framework.decorators import api_view
from rest_framework.response import Response

def calculate_weather_risk(wind_mph, rain_in_hr, snow_in_hr, load_weight_lbs):
    """
    Evaluates weather risk based on wind, rain, snow, and truck load weight.
    Rules derived from the assessment PDF.
    """
    # 1. Load & Extreme Wind Overrides
    if wind_mph >= 55:
        return 'No Travel'
    if 45 <= wind_mph <= 54 and load_weight_lbs > 30000:
        return 'No Travel'
    if 35 <= wind_mph <= 44 and load_weight_lbs > 40000:
        return 'Severe'

    # 2. Wind Risk Thresholds
    if wind_mph >= 45:
        wind_risk = 'Severe'
    elif wind_mph >= 35:
        wind_risk = 'High'
    elif wind_mph >= 25:
        wind_risk = 'Moderate'
    else:
        wind_risk = 'Low'

    # 3. Rain Risk Thresholds
    if rain_in_hr > 1.00:
        rain_risk = 'No Travel'
    elif rain_in_hr >= 0.50:
        rain_risk = 'Severe'
    elif rain_in_hr >= 0.25:
        rain_risk = 'High'
    elif rain_in_hr >= 0.10:
        rain_risk = 'Moderate'
    else:
        rain_risk = 'Low'

    # 4. Snow Risk Thresholds
    if snow_in_hr > 3.0:
        snow_risk = 'No Travel'
    elif snow_in_hr >= 2.0:
        snow_risk = 'Severe'
    elif snow_in_hr >= 1.0:
        snow_risk = 'High'
    elif snow_in_hr >= 0.5:
        snow_risk = 'Moderate'
    else:
        snow_risk = 'Low'

    # Hierarchy of risks: No Travel > Severe > High > Moderate > Low
    risk_levels = {'No Travel': 5, 'Severe': 4, 'High': 3, 'Moderate': 2, 'Low': 1}
    risks = [wind_risk, rain_risk, snow_risk]
    
    highest_risk = max(risks, key=lambda x: risk_levels[x])
    return highest_risk

@api_view(['POST'])
def calculate_route_weather(request):
    data = request.data
    origin = data.get('origin', '')
    destination = data.get('destination', '')
    load_weight = float(data.get('load_weight', 0))

    if not origin or not destination:
        return Response({'error': 'Origin and destination are required.'}, status=400)

    # Test risk calculation locally with dummy checkpoint values
    sample_risk = calculate_weather_risk(wind_mph=38, rain_in_hr=0.05, snow_in_hr=0.0, load_weight_lbs=load_weight)

    return Response({
        'status': 'success',
        'origin': origin,
        'destination': destination,
        'load_weight_lbs': load_weight,
        'sample_evaluated_risk': sample_risk,
        'message': 'Risk evaluation logic successfully integrated.'
    })
import requests

data = {'path': 'workdir/repo'}
try:
    response = requests.post('http://localhost:8000/suggest-improvements', json=data, timeout=60)
    print('Status:', response.status_code)
    if response.status_code == 200:
        result = response.json()
        print('Keys:', list(result.keys()))
        if 'suggestions' in result:
            print('Number of suggestions:', len(result['suggestions']))
            for i, s in enumerate(result['suggestions']):
                print(f'{i+1}. Title: {s.get("title", "No title")}')
                print(f'   Desc: {s.get("description", "No desc")}')
        else:
            print('No suggestions key')
            print('Full response:', result)
    else:
        print('Response text:', response.text)
except Exception as e:
    print('Error:', e)
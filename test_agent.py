#!/usr/bin/env python3
"""Test script to verify the agent is working correctly"""

import asyncio
import httpx
import json

async def test_agent():
    """Test the agent endpoint"""
    url = "http://localhost:8000/api/agent/run"
    
    # Test with a public IP that might be used for scanning tests
    test_target = "8.8.8.8"  # Google DNS
    
    payload = {
        "target": test_target,
        "scan_type": "full"
    }
    
    print(f"Testing agent with target: {test_target}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print("-" * 60)
    
    try:
        async with httpx.AsyncClient(timeout=600) as client:
            response = await client.post(url, json=payload)
            
            print(f"Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"\nAgent Response:")
                print(f"Target: {data.get('target')}")
                print(f"Total Iterations: {data.get('total_iterations')}")
                print(f"Tools Called: {data.get('tools_called')}")
                print(f"Steps Count: {len(data.get('steps', []))}")
                
                print(f"\nSteps Details:")
                for i, step in enumerate(data.get('steps', [])):
                    print(f"\nStep {i+1}:")
                    print(f"  Type: {step.get('type')}")
                    if step.get('type') == 'tool':
                        print(f"  Tool: {step.get('tool')}")
                        print(f"  Result Length: {len(step.get('result', ''))}")
                        print(f"  Result Preview: {step.get('result', '')[:200]}")
                    else:  # final
                        print(f"  Content: {step.get('content', '')[:200]}")
            else:
                print(f"Error Response: {response.text}")
                
    except httpx.ConnectError as e:
        print(f"Connection Error: Cannot connect to {url}")
        print(f"Make sure the backend is running: uvicorn main:app --reload")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {str(e)}")

async def test_tools_directly():
    """Test tools endpoints directly"""
    print("\n" + "="*60)
    print("Testing Tools API Directly")
    print("="*60)
    
    tools_base = "http://localhost:9000/api/tools"
    test_target = "8.8.8.8"
    
    tools_to_test = [
        ("nmap", f"{tools_base}/nmap", {"target": test_target, "scan_type": "quick"}),
        ("gobuster", f"{tools_base}/gobuster", {"target": test_target, "scan_type": "80"}),
    ]
    
    for tool_name, url, payload in tools_to_test:
        print(f"\nTesting {tool_name} at {url}")
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(url, json=payload)
                print(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Has 'output' field: {'output' in data}")
                    print(f"Has 'error' field: {'error' in data}")
                    if data.get('error'):
                        print(f"Error flag: {data.get('error')}")
                        print(f"Output: {data.get('output', 'N/A')[:100]}")
                    else:
                        print(f"Output length: {len(data.get('output', ''))}")
                else:
                    print(f"Response: {response.text[:200]}")
        except Exception as e:
            print(f"Error: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    print("Agent & Tools Test Suite")
    print("="*60)
    
    # Test tools first
    asyncio.run(test_tools_directly())
    
    # Then test agent
    print("\n" + "="*60)
    print("Testing Agent Endpoint")
    print("="*60)
    asyncio.run(test_agent())

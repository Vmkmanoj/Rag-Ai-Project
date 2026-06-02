from tavily import TavilyClient
import ollama

tavily = TavilyClient(api_key="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")

query = "best sunscreens for dry skin"

results = tavily.search(
    query=query,
    max_results=5
)

response = ollama.chat(
    model="mistral",
    messages=[
        {
            "role": "user",
            "content": f"""
            Based on these search results:

            {results}

            Recommend the top 3 products.
            and aslo suggest the best one among them and explain why it is the best.
            show product name, price and link to buy it.
            """
        }
    ]
)

print(response["message"]["content"])
import { View, Text, Button } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import { Client } from '@connectrpc/connect';
import { ElizaService } from '@buf/connectrpc_eliza.bufbuild_es/connectrpc/eliza/v1/eliza_pb';
import { useState } from 'react';

interface Props {
  client: Client<typeof ElizaService>;
}

export default function TestPage({ client }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<{ sentence: string; ts: number }[]>(
    [],
  );
  const appendMessage = (sentence: string) => {
    setMessages((prev) => [...prev, { sentence, ts: Date.now() }]);
  };

  const sayHi = async () => {
    setMessages([]);
    setIsLoading(true);
    client
      .say({
        sentence: 'I feel happy.',
      })
      .then((res) => {
        setIsLoading(false);
        console.log('[connect.say]', res);
        appendMessage(res.sentence);
      });
  };

  const introduce = async () => {
    setMessages([]);
    setIsLoading(true);
    const res = client.introduce({ name: 'Joseph' });
    for await (const chunk of res) {
      console.log('[connect.introduce]', chunk);
      appendMessage(chunk.sentence);
    }
    setIsLoading(false);
  };

  return (
    <View>
      <View>
        <Button disabled={isLoading} onClick={introduce}>
          Introduce
        </Button>
        <Button disabled={isLoading} onClick={sayHi}>
          Say Hi
        </Button>
      </View>
      <View>
        {messages.map(({ sentence, ts }) => (
          <View key={ts}>
            <Text>{sentence}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

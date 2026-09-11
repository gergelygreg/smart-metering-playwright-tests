import {
  connect,
  type IClientOptions,
  type MqttClient,
} from 'mqtt';

export async function connectClient(
  mqttUrl: string,
  options: IClientOptions,
): Promise<MqttClient> {
  return await new Promise<MqttClient>(
    (resolve, reject) => {
      const client = connect(mqttUrl, options);

      const onError = (error: Error) => {
        client.removeListener('connect', onConnect);
        reject(error);
      };

      const onConnect = () => {
        client.removeListener('error', onError);
        resolve(client);
      };

      client.once('error', onError);
      client.once('connect', onConnect);
    },
  );
}

export async function publishMessage(
  client: MqttClient,
  topic: string,
  payload: string,
  options: { qos: 0 | 1 | 2; retain?: boolean },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.publish(
      topic,
      payload,
      options,
      (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

export async function closeClient(
  client: MqttClient,
): Promise<void> {
  await new Promise<void>((resolve) => {
    client.end(false, {}, () => resolve());
  });
}
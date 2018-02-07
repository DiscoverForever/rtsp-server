const axios = require('axios');
const Stream = require('node-rtsp-stream');
const {
  exec
} = require('child_process');
// const BASE_URL = 'http://127.0.0.1:8080/api/';
const HOST = 'http://127.0.0.1';
const BASE_URL = 'http://127.0.0.1:8080/api';
const STARED_SERVERS = [];
/**
 * 启动服务
 * @param {*} req 
 * @param {*} res 
 */
async function startServer(req, res) {
  const name = req.query.name ? req.query.name : 'name';
  const streamUrl = req.query.streamUrl;
  // 查找已启动的rtsp视频转换服务
  const startedServer = STARED_SERVERS.find(streaServer => streaServer.streamUrl === streamUrl);
  const port = startedServer ? startedServer.port : 7000 + Math.round(Math.random() * 10) * 10 + Math.round(Math.random() * 10);
  // 查找当前HOST的集群是否已经存在
  let clusters = await searchCluster(`videoServerIp:"${HOST}"`);
  let cluster = clusters[0];
  let stream = startedServer && startedServer.stream;
  console.log(STARED_SERVERS)
  if (!startedServer) {
    stream = new Stream({
      name,
      streamUrl,
      wsPort: port
    });
    stream.once('camdata', () => {
      res.jsonp({
        data: {
          port,
          wsUrl: `${HOST.replace(/http/, 'ws')}:${port}`,
          cluster,
          pid: stream.mpeg1Muxer.stream.pid
        }
      });
    });

    STARED_SERVERS.push({
      port,
      wsUrl: `${HOST.replace(/http/, 'ws')}:${port}`,
      stream,
      streamUrl,
      cluster,
      pid: stream.mpeg1Muxer.stream.pid
    });
  } else {
    res.jsonp({data: { wsUrl: startedServer.wsUrl }});
  }
  if (clusters.length > 0) {
    cluster = await updateCluster(Object.assign(cluster, { videoChannelNumber : cluster.videoChannelNumber + 1 }))
  } else {
    cluster = await createCluster(HOST, 'rtsp-server', HOST, 'ctec', 0, HOST, 'root', process.env.PORT || '3000', 'root');
  }
  
  // stream.mpeg1Muxer.stream.kill();
  

}

/**
 * 关闭服务
 * @param {*} port 
 */
function stopServer(req, res) {
  const pid = req.query.pid;
  exec(`kill -9 ${pid}`, (err, stdout, stderr) => {
    if (err) {
      console.error('子进程:', pid, '进程关闭失败', err.message);
      res.status(500);
      res.send(err)
    } else {
      console.log('子进程:', pid, '进程关闭成功');
      res.jsonp({
        data: {
          pid
        }
      });
    }
  });
}

/**
 * 重启服务
 * @param {*} port 
 */
function restartServer(req, res) {
  stopServer(req.query.pid);
  startServer(req.query.port);
}

/**
 * 创建集群节点
 * @param {*} clusterNodeIp 
 * @param {*} clusterNodeName 
 * @param {*} dbIp 
 * @param {*} dbName 
 * @param {*} videoChannelNumber 
 * @param {*} videoServerIp 
 * @param {*} videoServerPassword 
 * @param {*} videoServerPort 
 * @param {*} videoServerUsername 
 */
async function createCluster(clusterNodeIp, clusterNodeName, dbIp, dbName, videoChannelNumber, videoServerIp, videoServerPassword, videoServerPort, videoServerUsername) {
  const params = {
    clusterNodeIp,
    clusterNodeName,
    dbIp,
    dbName,
    videoChannelNumber,
    videoServerIp,
    videoServerPassword,
    videoServerPort,
    videoServerUsername
  };
  const Authorization = await getJWT();
  const options = {
    headers: {
      Authorization
    }
  }
  const res = await axios.post(`${BASE_URL}/clusters`, params, options);
  
  return res.data;
}

async function updateCluster(cluster) {
  const Authorization = await getJWT();
  const options = {
    headers: {
      Authorization
    }
  }
  const res = await axios.put(`${BASE_URL}/clusters`, cluster, options);
  return res.data;
}

async function searchCluster(query) {
  const Authorization = await getJWT();
  const options = {
    headers: {
      Authorization
    },
    params: {
      query
    }
  }
  const res = await axios.get(`${BASE_URL}/_search/clusters`, options);
  return res.data;
}

async function getJWT(username = 'admin', password = 'admin') {
  const params = {
    username,
    password,
    rememberMe: true
  };

  let res;
  try {
    res = await axios.post(`${BASE_URL}/authenticate`, params);
  } catch (error) {
    console.error('获取token失败!', error);
  }
  return `Bearer ${res.data.id_token}`;
}

module.exports = {
  startServer,
  stopServer
}
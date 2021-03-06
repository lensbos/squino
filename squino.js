/*
	npm install express
*/

var express 		= require('express');
var https 		= require('https');
var url 		= require('url');
var morgan		= require('morgan');
var request		= require('request');
var slack		= require('node-slack');
var config	    	= require('./squino_config');
var YouTrackAPI 	= require('./lib/youtrackapi');
var HelpScoutAPI 	= require('./lib/helpscoutapi');
var ProdPadAPI   	= require('./lib/prodpadapi');


var app = express();

app.use(morgan('combined'));

app.get( '/prodpad/feedback', function( req, res ) {
	runFeedback( req, res );
})
app.get( '/youtrack/create/ist', function( req, res ) {
	runYouTrack( req, res, config.youtrack_project_1, config.youtrack_project_1_workflow);
});
app.get( '/youtrack/create/inf', function( req, res ) {
	runYouTrack( req, res, config.youtrack_project_2, config.youtrack_project_2_workflow);
});

app.listen( config.port );

console.log( 'Started Squino Server');

function runYouTrack ( servRequest, servResponse, project, workflowId )
{

	var youtrack = new YouTrackAPI( config.youtrack_url );
	var helpscout = new HelpScoutAPI( config.helpscout_url, config.helpscout_key );

	var conversationId = servRequest.query.id;
	
	helpscout.getConversation( conversationId, function( err, data ) 
	{	
		if (err)	
        	{
        		servResponse.send( 
				"An error occurred with the HelpScout API, try again later: "+err
  			);
  			return;
        	}

		youtrack.login( config.youtrack_user, config.youtrack_password, function(err, cookie)
			{

				if (err)
				{
					servResponse.send( "An error occurred with the YouTrack API, try again later: "+err );
					return;	
				}

				youtrack.cookie = cookie;	

				youtrack.createIssue( 
					project, 
					data.item.subject, 
					data.item.preview + '\r\nImported From: https://secure.helpscout.net/conversation/'+conversationId, 
					function( err, body)
					{			
						console.log( 'Posted Issue to YouTrack:'+data.item.subject);
						helpscout.executeWorkflow( workflowId, conversationId, function( err, dataWorkflow )
						{
							console.log( 'executed workflow error code(' + err +')');
							servResponse.send(  
								"<head><script type='text/javascript'> window.location='https://secure.helpscout.net/conversation/"+conversationId+"';</script></head>"
  					 		);
						});						
					} 
				);	

			});			
	} )
}

function runFeedback( servRequest, servResponse )
{
	var helpscout = new HelpScoutAPI( config.helpscout_url, config.helpscout_key );

	var conversationId = servRequest.query.id;

	helpscout.getConversation( conversationId, function( err, data ) {
		
		if (err)	
        	{
        		servResponse.send(  						
  				"An error occurred with the HelpScout API, try again later: "+err
  			);
  			return;
        	}

		var prodpad = new ProdPadAPI( config.prodpad_url, config.prodpad_key );		

		prodpad.createFeedback( 
			data.item.customer.firstName + ' ' + data.item.customer.lastName,
			data.item.customer.email,
			data.item.subject,
			data.item.preview + '<br/><a href=https://secure.helpscout.net/conversation/'+conversationId+'>Link to Help Scout Ticket</a>',
				function( err, prodpadData ) {

					if (err) 
					{ 
						servResponse.send( "An error occurred with the ProdPad API, try again later: "+err ) ;
						return;
					}

					helpscout.executeWorkflow( 6590, conversationId, function( err, dataWorkflow )
					{
						console.log( 'executed workflow: ' + err );
						servResponse.send(  
							"<head><script type='text/javascript'> window.location='https://secure.helpscout.net/conversation/"+conversationId+"';</script></head>"
  					 	);
					});
				}
			);		
	} )
}
